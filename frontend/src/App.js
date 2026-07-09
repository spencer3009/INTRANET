import { useState, useEffect, createContext, useContext } from "react";
import axios from "axios";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { closeNotificationSocket, sendPageView } from "@/hooks/useNotificationSocket";
import { onForegroundMessage } from "@/lib/firebase";
import { playPushSound, primePushAudio } from "@/lib/pushSound";
import ErrorBoundary from "@/components/ErrorBoundary";
import BirthdayPopupCarousel from "@/components/BirthdayPopupCarousel";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import SchoolLoginPage from "@/pages/SchoolLoginPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import WelcomePage from "@/pages/WelcomePage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import UsersPage from "@/pages/UsersPage";
import DiagRegistroAuxiliarPage from "@/pages/DiagRegistroAuxiliarPage";
import AcademicSettingsPage from "@/pages/AcademicSettingsPage";
import AdminCurricularAreasPage from "@/pages/AdminCurricularAreasPage";
import AdminCierreBimestrePage from "@/pages/AdminCierreBimestrePage";
import LibretaPage from "@/pages/LibretaPage";
import MisTutoriasPage from "@/pages/MisTutoriasPage";
import AcademicYearsPage from "@/pages/AcademicYearsPage";
import SubjectsPage from "@/pages/SubjectsPage";
import SchedulePage from "@/pages/SchedulePage";
import MessagesPage from "@/pages/MessagesPage";
import AttendancePage from "@/pages/AttendancePage";
import CalendarPage from "@/pages/CalendarPage";
import SurveysPage from "@/pages/SurveysPage";
import DisciplinePage from "@/pages/DisciplinePage";
import NewsPage from "@/pages/NewsPage";
import AccountingPage from "@/pages/AccountingPage";
import MorososPage from "@/pages/MorososPage";
import CourseDetailPage from "@/pages/CourseDetailPage";
import ProfilePage from "@/pages/ProfilePage";
import TeacherAssignmentsPage from "@/pages/TeacherAssignmentsPage";
import ConsolidatedGradesPage from "@/pages/ConsolidatedGradesPage";
import StudentDashboardPage from "@/pages/StudentDashboardPage";
import StudentCoursesPage from "@/pages/StudentCoursesPage";
import StudentCourseDetailPage from "@/pages/StudentCourseDetailPage";
import StudentSchedulePage from "@/pages/StudentSchedulePage";
import StudentTasksPage from "@/pages/StudentTasksPage";
import StudentGradesPage from "@/pages/StudentGradesPage";
import StudentAttendancePage from "@/pages/StudentAttendancePage";
import StudentProfilePage from "@/pages/StudentProfilePage";
import TeacherDashboardPage from "@/pages/TeacherDashboardPage";
import TeacherCoursesPage from "@/pages/TeacherCoursesPage";
import TeacherStudentsPage from "@/pages/TeacherStudentsPage";
import TeacherAssignmentsViewPage from "@/pages/TeacherAssignmentsViewPage";
import TeacherGradesPage from "@/pages/TeacherGradesPage";
import TeacherAttendancePage from "@/pages/TeacherAttendancePage";
import TeacherMessagesPage from "@/pages/TeacherMessagesPage";
import TeacherProfilePage from "@/pages/TeacherProfilePage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import AdminStudentsPage from "@/pages/AdminStudentsPage";
import AdminTeachersPage from "@/pages/AdminTeachersPage";
import AdminUsersPage from "@/pages/AdminUsersPage";
import AdminAcademicStructurePage from "@/pages/AdminAcademicStructurePage";
import AdminTutoringOverviewPage from "@/pages/AdminTutoringOverviewPage";
import TeacherObservationsPage from "@/pages/TeacherObservationsPage";
import AdminGradesManagementPage from "@/pages/AdminGradesManagementPage";
import AdminAttendancePage from "@/pages/AdminAttendancePage";
import AdminTasksPage from "@/pages/AdminTasksPage";
import AdminExamsPage from "@/pages/AdminExamsPage";
import AdminSettingsPage from "@/pages/AdminSettingsPage";
import PlantillaEditorPage from "@/pages/PlantillaEditorPage";
import AdminBrandingPage from "@/pages/AdminBrandingPage";
import AdminAnnouncementsPage from "@/pages/AdminAnnouncementsPage";
import AdminLiveClassesPage from "@/pages/AdminLiveClassesPage";
import AdminMessagesPage from "@/pages/AdminMessagesPage";
import AdminRolesPage from "@/pages/AdminRolesPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ExamAttemptPage from "@/pages/ExamAttemptPage";
import ExamResultPage from "@/pages/ExamResultPage";
import StudentExamSchedulePage from "@/pages/StudentExamSchedulePage";
import StudentMessagesPage from "@/pages/StudentMessagesPage";
import TeacherLiveClassesPage from "@/pages/TeacherLiveClassesPage";
import StudentLiveClassesPage from "@/pages/StudentLiveClassesPage";
// Parent Portal imports
import ParentDashboardPage from "@/pages/ParentDashboardPage";
import ParentEnrollmentForm from "@/pages/ParentEnrollmentForm";
import ParentProfilePage from "@/pages/ParentProfilePage";
import ParentTasksPage from "@/pages/ParentTasksPage";
import ParentGradesPage from "@/pages/ParentGradesPage";
import ParentAttendancePage from "@/pages/ParentAttendancePage";
import PsicologiaPerfilPage from "@/pages/psicologia/PsicologiaPerfilPage";
import ParentCoursesPage from "@/pages/ParentCoursesPage";
import ParentSchedulePage from "@/pages/ParentSchedulePage";
import ParentExamsPage from "@/pages/ParentExamsPage";
import ParentMessagesPage from "@/pages/ParentMessagesPage";
import ParentCourseDetailPage from "@/pages/ParentCourseDetailPage";
import ParentPaymentsPage from "@/pages/ParentPaymentsPage";
import HealthWellnessPage from "@/pages/HealthWellnessPage";
import ParentHealthPage from "@/pages/ParentHealthPage";
import ParentPsychologyMessages from "@/components/ParentPsychologyMessages";
import ParentPsychMessagesPage from "@/pages/ParentPsychMessagesPage";
import TopicoPage from "@/pages/TopicoPage";
import AuxTopicoPage from "@/pages/AuxTopicoPage";
import PsicologiaPage from "@/pages/PsicologiaPage";
import TeacherHealthPage from "@/pages/TeacherHealthPage";
import TeacherTopicoPage from "@/pages/TeacherTopicoPage";
import TeacherPsicologiaPage from "@/pages/TeacherPsicologiaPage";
import AdminHealthPage from "@/pages/AdminHealthPage";
import AdminTopicoPage from "@/pages/AdminTopicoPage";
import AdminPsicologiaPage from "@/pages/AdminPsicologiaPage";
import { Toaster, toast } from "sonner";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import SubscriptionProvider, { useSubscription } from "@/contexts/SubscriptionContext";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import SuspendedScreen from "@/components/SuspendedScreen";
import PaymentBlockModal from "@/components/PaymentBlockModal";
// Support Panel imports
import SupportLayout from "@/components/SupportLayout";
import SupportDashboardPage from "@/pages/SupportDashboardPage";
import SupportSchoolsPage from "@/pages/SupportSchoolsPage";
import SupportSessionsPage from "@/pages/SupportSessionsPage";
import SupportProfilePage from "@/pages/SupportProfilePage";
import SupportPricingPage from "@/pages/SupportPricingPage";
import SupportAcademiaPage from "@/pages/SupportAcademiaPage";
import AcademiaPortalPage from "@/pages/AcademiaPortalPage";
import SupportFinancesPage from "@/pages/SupportFinancesPage";
import SupportDemosPage from "@/pages/SupportDemosPage";
import SupportDiagnosticsPage from "@/pages/SupportDiagnosticsPage";
import PsicologiaDashboardPage from "@/pages/psicologia/PsicologiaDashboardPage";
import PsicologiaEstudiantesPage from "@/pages/psicologia/PsicologiaEstudiantesPage";
import PsicologiaFichaPage from "@/pages/psicologia/PsicologiaFichaPage";
import PsicologiaFichasListPage from "@/pages/psicologia/PsicologiaFichasListPage";
import PsicologiaSesionesPage from "@/pages/psicologia/PsicologiaSesionesPage";
import PsicologiaMensajesPage from "@/pages/psicologia/PsicologiaMensajesPage";
import PsicologiaAgendaPage from "@/pages/psicologia/PsicologiaAgendaPage";
import PsicologiaTalleresPage from "@/pages/psicologia/PsicologiaTalleresPage";
import PaeDashboard from "@/pages/pae/PaeDashboard";
import PaeScanner from "@/pages/pae/PaeScanner";
import PaeRegistrosDia from "@/pages/pae/PaeRegistrosDia";
import MovilidadDashboard from "@/pages/movilidad/MovilidadDashboard";
import MovilidadScanner from "@/pages/movilidad/MovilidadScanner";
import MovilidadRegistrosDia from "@/pages/movilidad/MovilidadRegistrosDia";
import PortalSelector from "@/components/PortalSelector";
import AuxAsistenciaDashboard from "@/pages/aux-asistencia/AuxAsistenciaDashboard";
import AuxAsistenciaScanner from "@/pages/aux-asistencia/AuxAsistenciaScanner";
import AuxAsistenciaMisEscaneos from "@/pages/aux-asistencia/AuxAsistenciaMisEscaneos";
import CoordinacionDashboardPage from "@/pages/coordinacion/CoordinacionDashboardPage";
import IncidenciasListPage from "@/pages/coordinacion/IncidenciasListPage";
import IncidenciaFormPage from "@/pages/coordinacion/IncidenciaFormPage";
import IncidenciaDetailPage from "@/pages/coordinacion/IncidenciaDetailPage";
import DerivacionesListPage from "@/pages/coordinacion/DerivacionesListPage";
import DerivacionDetailPage from "@/pages/coordinacion/DerivacionDetailPage";
import ReunionesListPage from "@/pages/coordinacion/ReunionesListPage";
import ReunionDetailPage from "@/pages/coordinacion/ReunionDetailPage";
import CoordinacionPlaceholderPage from "@/pages/coordinacion/CoordinacionPlaceholderPage";
import EstudiantesFichaPage from "@/pages/coordinacion/EstudiantesFichaPage";
import AgendaPage from "@/pages/coordinacion/AgendaPage";
import ParentCoordinacionView from "@/pages/coordinacion/ParentCoordinacionView";
import CharlasListPage from "@/pages/coordinacion/CharlasListPage";
import CharlaDetailPage from "@/pages/coordinacion/CharlaDetailPage";
import SeguimientosListPage from "@/pages/coordinacion/SeguimientosListPage";
import ReportesPage from "@/pages/coordinacion/ReportesPage";
import CoordinacionPerfilPage from "@/pages/coordinacion/CoordinacionPerfilPage";

const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || "edunet.pe";

// ══════════════════════════════════════════════════════════════════════════════
// ROLE-BASED ACCESS HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const ADMIN_ROLES = ["owner", "admin", "director", "coordinator"];
const STAFF_ROLES = ["owner", "admin", "director", "coordinator", "teacher", "psicologo", "auxiliar", "auxiliar_asistencia", "auxiliar_alimentacion"];

const isStudent = (user) => user?.role === "student";
const isParent = (user) => user?.role === "parent";
const isTeacher = (user) => user?.role === "teacher";
const isPsicologo = (user) => user?.role === "psicologo";
const isCoordinator = (user) => user?.role === "coordinator";
const isAuxiliarAlimentacion = (user) => user?.role === "auxiliar_alimentacion";
const isAuxiliarMovilidad = (user) => user?.role === "auxiliar_movilidad";
const isAuxiliarAsistencia = (user) => user?.role === "auxiliar_asistencia";
const isAuxiliarTopico = (user) => user?.role === "auxiliar_topico";
const isStaff = (user) => STAFF_ROLES.includes(user?.role);
const isAdmin = (user) => ADMIN_ROLES.includes(user?.role);
// Specific check for role="admin" only (for Admin Portal)
const isAdminOnly = (user) => user?.role === "admin";
// Global support user check
const isSupportGlobal = (user) => user?.role === "system_admin_global" || user?.is_support_global;

// ══════════════════════════════════════════════════════════════════════════════
// TENANT CONTEXT - Provides tenant info throughout the app
// ══════════════════════════════════════════════════════════════════════════════


const TenantContext = createContext({
  subdomain: null,
  isSubdomainMode: false,
  getSchoolPath: (path) => path,
  getSchoolUrl: (subdomain) => `https://${subdomain}.${BASE_DOMAIN}`,
});

export const useTenant = () => useContext(TenantContext);

// ══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT DETECTION
// Determines if we're in an environment that supports wildcard subdomains
// ══════════════════════════════════════════════════════════════════════════════

function detectEnvironment() {
  const hostname = window.location.hostname.toLowerCase();
  
  // Check if we're on a real subdomain of the base domain
  // e.g., trento.edunet.pe
  if (hostname.endsWith(`.${BASE_DOMAIN}`) && hostname !== `www.${BASE_DOMAIN}`) {
    const subdomain = hostname.replace(`.${BASE_DOMAIN}`, '');
    if (subdomain && !subdomain.includes('.')) {
      return { 
        mode: 'subdomain', 
        subdomain,
        supportsWildcard: true 
      };
    }
  }
  
  // Main domain or preview environment - use route-based approach
  return { 
    mode: 'route', 
    subdomain: null,
    supportsWildcard: false 
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// SHOPIFY RULE: Redirect to school route/subdomain if user has one
// ══════════════════════════════════════════════════════════════════════════════

// Human-friendly page names for Support Panel → Sesiones Activas.
// Matches the last path segment of the URL; fallback to the raw pathname.
const PAGE_NAME_MAP = {
  dashboard: "Dashboard",
  inicio: "Inicio",
  teacher: "Panel Docente",
  student: "Panel Alumno",
  parent: "Panel Padre",
  admin: "Panel Admin",
  attendance: "Asistencia",
  asistencia: "Asistencia",
  grades: "Notas",
  notas: "Notas",
  users: "Usuarios",
  usuarios: "Usuarios",
  messages: "Mensajes",
  mensajes: "Mensajes",
  messaging: "Mensajes",
  schedule: "Horarios",
  horarios: "Horarios",
  horario: "Horarios",
  accounting: "Contabilidad",
  contabilidad: "Contabilidad",
  cursos: "Cursos",
  courses: "Cursos",
  subjects: "Asignaturas",
  asignaturas: "Asignaturas",
  calendar: "Calendario",
  calendario: "Calendario",
  news: "Noticias",
  noticias: "Noticias",
  settings: "Configuración",
  ajustes: "Configuración",
  profile: "Perfil",
  perfil: "Perfil",
  "registro-auxiliar": "Registro Auxiliar",
  psicologia: "Psicología",
  topico: "Tópico",
  pae: "PAE / Alimentación",
  movilidad: "Movilidad",
  support: "Panel Soporte",
  sessions: "Sesiones Activas",
  schools: "Colegios",
  finances: "Finanzas",
  pricing: "Precios",
  "asignacion-docente": "Asignación Docente",
  "teacher-assignment": "Asignación Docente",
  discipline: "Disciplina",
  disciplina: "Disciplina",
  events: "Eventos",
  eventos: "Eventos",
  surveys: "Encuestas",
  encuestas: "Encuestas",
};

// Known simultaneous HTTP calls each page fires on entry — measured
// LIVE at runtime by the axios interceptor below. This map is no longer
// a source of truth; PageViewTracker counts real requests per navigation.

// Paths excluded from the page-request counter. These are system calls
// (health probes, session polling, subscription status) that run
// independently of what page the user is on.
const PAGE_REQ_EXCLUDE = [
  "/api/health",
  "/api/support/active-sessions",
  "/api/subscription/status",
];

// Mutable counter written by the axios interceptor, read by the tracker.
// Kept module-level because it must be shared across every component.
let _pageReqCounter = 0;

// Install interceptor ONCE at module load. We guard with a symbol on
// the axios.defaults object so hot-reload in dev doesn't double-wrap.
if (!axios.defaults.__pageReqInterceptorInstalled) {
  axios.interceptors.request.use((config) => {
    try {
      const url = config?.url || "";
      if (url.includes("/api/") && !PAGE_REQ_EXCLUDE.some(ex => url.includes(ex))) {
        _pageReqCounter += 1;
      }
    } catch { /* ignore */ }
    return config;
  });
  axios.defaults.__pageReqInterceptorInstalled = true;
}

// ──────────────────────────────────────────────────────────────────────────────
// Auth-expiry interceptor
// On any 401 response, decode the JWT in localStorage. If its `exp` is in
// the past (or the token is malformed/missing) we conclude the session
// has truly expired and fire a single `auth:expired` window event. The
// App component listens for this event, shows a toast, and logs out.
// We do NOT auto-logout on 401s that happen while the token is still
// valid — those indicate a permission problem, not expiry.
// ──────────────────────────────────────────────────────────────────────────────
function _isJwtExpired(raw) {
  if (!raw || typeof raw !== "string") return true;
  try {
    const payload = raw.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
    );
    if (!decoded || typeof decoded.exp !== "number") return false; // no exp claim → treat as valid
    return decoded.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

if (!axios.defaults.__authExpiryInterceptorInstalled) {
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      try {
        const status = error?.response?.status;
        const url = error?.config?.url || "";
        // Skip login endpoint — a 401 there is "bad credentials", not expiry
        const isLoginCall = url.includes("/api/auth/login");
        if (status === 401 && !isLoginCall) {
          const localToken = localStorage.getItem("token");
          if (_isJwtExpired(localToken)) {
            window.dispatchEvent(new CustomEvent("auth:expired", {
              detail: { source: "http", status, url }
            }));
          }
        }
      } catch { /* ignore */ }
      return Promise.reject(error);
    }
  );
  axios.defaults.__authExpiryInterceptorInstalled = true;
}

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    // Resolve friendly label from the deepest known segment, else use path.
    const segments = location.pathname.split("/").filter(Boolean);
    let label = location.pathname || "/";
    for (let i = segments.length - 1; i >= 0; i--) {
      const hit = PAGE_NAME_MAP[segments[i]];
      if (hit) { label = hit; break; }
    }
    // If the user is on a course detail page (/curso/<uuid>), extract the
    // subject UUID so the Support Panel can resolve subject name, grade,
    // section and level for that specific session.
    const courseMatch = location.pathname.match(/\/curso\/([a-f0-9-]{36})/i);
    const metadata = courseMatch ? { subject_id: courseMatch[1] } : {};
    // Delta measurement: snapshot the counter NOW, then after 1500ms
    // subtract to get the number of requests this navigation triggered.
    // Avoids races with sibling useEffects that fire axios during mount.
    const startCount = _pageReqCounter;
    const t = setTimeout(() => {
      const delta = Math.max(0, _pageReqCounter - startCount);
      console.log('[PageView]', label, delta, metadata);
      sendPageView(label, delta, metadata);
    }, 1500);
    return () => clearTimeout(t);
  }, [location.pathname]);
  return null;
}

function ShopifyRedirect({ user, environment }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!user?.subdomain) return;
    
    // Demo users: always use route-based approach (no wildcard subdomain)
    if (user.is_demo_user) {
      const schoolPrefix = `/${user.subdomain}`;
      if (!location.pathname.startsWith(schoolPrefix)) {
        navigate(`${schoolPrefix}/dashboard`, { replace: true });
      }
      return;
    }

    // Already on correct subdomain
    if (environment.mode === 'subdomain' && environment.subdomain === user.subdomain) {
      return;
    }
    
    // In subdomain-supported environment, redirect to actual subdomain
    if (environment.supportsWildcard) {
      const targetUrl = `https://${user.subdomain}.${BASE_DOMAIN}${location.pathname}`;
      console.log(`[Shopify Rule] Redirecting to subdomain: ${targetUrl}`);
      window.location.href = targetUrl;
      return;
    }
    
    // In route-based mode, redirect to school route if not already there
    const schoolPrefix = `/${user.subdomain}`;
    if (!location.pathname.startsWith(schoolPrefix)) {
      // Only redirect to school route if trying to access dashboard
      if (location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/')) {
        const newPath = `${schoolPrefix}${location.pathname}`;
        console.log(`[Route] Redirecting to school route: ${newPath}`);
        navigate(newPath, { replace: true });
      }
    }
  }, [user, environment, location, navigate]);
  
  return null;
}

// Global CSS: Hide ChatPal widget elements when not on allowed pages
function ChatPalRouteGuard() {
  const location = useLocation();

  useEffect(() => {
    const STYLE_ID = "chatpal-visibility-css";
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        iframe[src*="chatterpal.me"],
        iframe[src*="chatpal.me"],
        div:has(> iframe[src*="chatterpal.me"]),
        div:has(> iframe[src*="chatpal.me"]) {
          display: none !important;
          visibility: hidden !important;
        }
        body.chatpal-active iframe[src*="chatterpal.me"],
        body.chatpal-active iframe[src*="chatpal.me"],
        body.chatpal-active div:has(> iframe[src*="chatterpal.me"]),
        body.chatpal-active div:has(> iframe[src*="chatpal.me"]),
        body.chatpal-landing-active iframe[src*="chatterpal.me"],
        body.chatpal-landing-active iframe[src*="chatpal.me"],
        body.chatpal-landing-active div:has(> iframe[src*="chatterpal.me"]),
        body.chatpal-landing-active div:has(> iframe[src*="chatpal.me"]) {
          display: block !important;
          visibility: visible !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const isAcademia = location.pathname.includes('/academia');
    const isLanding = location.pathname === '/';
    if (isAcademia || isLanding) return;

    const hideElements = () => {
      document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]').forEach(el => {
        if (el.querySelector('iframe[src*="chatterpal"]') || el.querySelector('iframe[src*="chatpal"]')) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      });
      document.querySelectorAll('iframe[src*="chatterpal"], iframe[src*="chatpal"]').forEach(el => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
      });
    };

    hideElements();
    const interval = setInterval(hideElements, 500);
    return () => clearInterval(interval);
  }, [location.pathname]);

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Protected Route Component
// ══════════════════════════════════════════════════════════════════════════════

function ProtectedRoute({ children, token, user, requireSchool = false, requireEmailVerified = true }) {
  const location = useLocation();
  
  if (!token) {
    // Extract subdomain from current path to redirect to school-specific login
    const pathMatch = location.pathname.match(/^\/([^/]+)/);
    const subdomain = pathMatch ? pathMatch[1] : null;
    // Paths que NUNCA son subdomains de colegios (rutas técnicas o known apps)
    const knownNonSchool = ['login', 'register', 'verify-email', 'onboarding', 'reset-password', 'school', 'support', 'libreta', 'mis-tutorias'];
    const isTechnicalPath = subdomain && (
      /\.(php|html?|aspx?|jsp|do|cgi|ico|map|js|css|png|jpg|jpeg|webp|svg|gif|txt|xml|json|woff2?|ttf|eot)$/i.test(subdomain)
      || /[^a-z0-9-]/i.test(subdomain)
    );
    const loginPath = subdomain && !knownNonSchool.includes(subdomain) && !isTechnicalPath
      ? `/${subdomain}/login`
      : '/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }
  
  if (requireEmailVerified && user && !user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  if (requireSchool && user && !user.subdomain) {
    return <Navigate to="/onboarding" replace />;
  }

  // Auxiliar de asistencia can ONLY access /aux-asistencia/* routes
  if (user?.role === 'auxiliar_asistencia') {
    const path = location.pathname;
    const isAllowed = path.includes('/aux-asistencia') || path.includes('/login') || path.includes('/mensajes');
    if (!isAllowed) {
      const sub = user.subdomain;
      const redirect = sub ? `/${sub}/aux-asistencia` : '/aux-asistencia';
      return <Navigate to={redirect} replace />;
    }
  }
  
  return children;
}

// ══════════════════════════════════════════════════════════════════════════════
// School Routes Wrapper - Handles /:subdomain/* routes
// ══════════════════════════════════════════════════════════════════════════════

// Backward compatibility: redirect /school/:subdomain/* → /:subdomain/*
function SchoolRedirect() {
  const { subdomain, "*": rest } = useParams();
  return <Navigate to={`/${subdomain}${rest ? `/${rest}` : ""}`} replace />;
}

function SchoolDashboardRoute({ user, token, onLogout }) {
  const { subdomain } = useParams();
  
  // Support users with switched context can access any school
  const isSupportSession = user?.is_support_session || user?.original_role === "system_admin_global";
  
  // Verify user has access to this school
  if (!isSupportSession && user?.subdomain !== subdomain) {
    return <NotFoundPage message={`No tienes acceso a ${subdomain}.${BASE_DOMAIN}`} />;
  }
  
  return <DashboardPage user={user} token={token} onLogout={onLogout} routeSubdomain={subdomain} />;
}

// Subscription Guard - wraps school content and enforces subscription states
function SubscriptionGuard({ token, user, children }) {
  const ctx = useSubscription();

  // Support users bypass all restrictions
  const isSupportUser = user?.role === "system_admin_global" || user?.original_role === "system_admin_global";
  if (isSupportUser) return children;

  // While loading, show content
  if (!ctx || ctx.loading || !ctx.sub) return children;

  const { plan_estado } = ctx.sub;

  // SUSPENDIDO - full block
  if (plan_estado === "SUSPENDIDO") {
    return <SuspendedScreen token={token} />;
  }

  // PAGO_OBLIGATORIO - show mandatory modal over content (not closeable)
  if (plan_estado === "PAGO_OBLIGATORIO") {
    return (
      <>
        {children}
        <PaymentBlockModal token={token} forceLock onClose={() => ctx.refresh()} />
      </>
    );
  }

  return children;
}

// Global subscription overlay - shows banner, auto-modal for PAGO_OBLIGATORIO, and SuspendedScreen
function GlobalSubscriptionOverlay({ token, user }) {
  const location = useLocation();
  if (!token || !user?.school_id) return null;
  const isSupportUser = user?.role === "system_admin_global" || user?.original_role === "system_admin_global";
  if (isSupportUser) return null;

  // Don't show on public pages (landing, login, register, etc.)
  const path = location.pathname;
  const isPublicPage = path === "/" || path.endsWith("/login") || path.endsWith("/register") || path === "/login" || path === "/register";
  if (isPublicPage) return null;

  return <SubscriptionEnforcer token={token} />;
}

function SubscriptionEnforcer({ token }) {
  const ctx = useSubscription();

  if (!ctx || ctx.loading || !ctx.sub) return null;

  const { plan_estado } = ctx.sub;

  // SUSPENDIDO or PAGO_OBLIGATORIO - banner + mandatory modal (non-dismissible)
  // Owner/admin can log in but must see the payment modal they cannot close
  if (plan_estado === "SUSPENDIDO" || plan_estado === "PAGO_OBLIGATORIO") {
    return (
      <>
        <SubscriptionBanner />
        <PaymentBlockModal token={token} forceLock onClose={() => ctx.refresh()} />
      </>
    );
  }

  // AVISO / RESTRICCION_PARCIAL - just the banner
  return <SubscriptionBanner />;
}

// ══════════════════════════════════════════════════════════════════════════════
// Main App Component
// ══════════════════════════════════════════════════════════════════════════════

function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [environment] = useState(() => detectEnvironment());
  const [activePortal, setActivePortal] = useState(() => localStorage.getItem("active_portal") || null);
  const [showPortalSelector, setShowPortalSelector] = useState(false);

  const handleLogin = (tokenVal, userData) => {
    localStorage.setItem("token", tokenVal);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
    // If user has additional_roles, show portal selector
    if ((userData?.additional_roles || []).length > 0) {
      setShowPortalSelector(true);
    } else {
      localStorage.setItem("active_portal", userData?.role || "");
      setActivePortal(userData?.role || "");
    }
  };

  const handlePortalSelect = (portalRole) => {
    localStorage.setItem("active_portal", portalRole);
    setActivePortal(portalRole);
    setShowPortalSelector(false);
    // Navigate to the correct portal
    const portalPaths = {
      auxiliar_alimentacion: "/pae",
      auxiliar_movilidad: "/movilidad",
      auxiliar_asistencia: "/aux-asistencia",
    };
    const path = portalPaths[portalRole];
    if (path) {
      const sub = user?.subdomain;
      window.location.href = sub ? `/${sub}${path}` : path;
    } else {
      // Primary role — go to default dashboard
      window.location.href = user?.subdomain ? `/${user.subdomain}/dashboard` : "/dashboard";
    }
  };

  const handleSwitchPortal = () => {
    setShowPortalSelector(true);
  };

  const handleUserUpdate = (updatedUser) => {
    // Merge with existing user data to preserve fields that might not be returned
    const mergedUser = { ...user, ...updatedUser };
    localStorage.setItem("user", JSON.stringify(mergedUser));
    setUser(mergedUser);
  };

  const handleLogout = () => {
    const sub = user?.subdomain;
    try { closeNotificationSocket(); } catch { /* ignore */ }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("active_portal");
    setToken("");
    setUser(null);
    if (sub) {
      window.location.href = `/${sub}/login`;
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // Global session-expiry listener.
  // Fired by (a) the WebSocket hook when the server rejects the socket with
  // 1008/4401/4403, or (b) the axios response interceptor when any HTTP call
  // returns 401 AND the stored JWT is actually expired.
  // Uses a ref-like guard so overlapping 401s from a burst of parallel calls
  // only produce ONE toast and ONE redirect.
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let handled = false;
    const onExpired = () => {
      if (handled) return;
      if (!localStorage.getItem("token")) return; // already logged out
      handled = true;
      try {
        toast.error("Tu sesión ha expirado. Por favor inicia sesión nuevamente.");
      } catch { /* ignore */ }
      // Small delay so the user actually sees the toast before redirect.
      setTimeout(() => {
        try { handleLogout(); } catch { /* ignore */ }
      }, 600);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.subdomain]);

  // ────────────────────────────────────────────────────────────────────────────
  // Push notification SOUND (PWA). Registrado una sola vez.
  //  - Background: el Service Worker hace postMessage {type:'PLAY_PUSH_SOUND'}
  //    y aquí reproducimos /sounds/notify.mp3 (solo si hay ventana visible).
  //  - Foreground: FCM dispara onMessage en la página; si data.playSound, sonamos.
  // NOTA: el MP3 propio solo suena con la app en primer plano; en background el
  // tono lo emite el sistema operativo (no el navegador).
  // ────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const playSound = () => playPushSound();

    // Cebar el audio en el PRIMER gesto del usuario (tap/click) en cualquier
    // parte de la app. Esto desbloquea el autoplay en móvil para que, cuando
    // llegue una push en foreground, el sonido propio (notify.mp3) pueda sonar.
    const primeOnce = () => { primePushAudio(); };
    window.addEventListener("pointerdown", primeOnce, { once: true });
    window.addEventListener("keydown", primeOnce, { once: true });

    // (a) Mensaje del Service Worker (push recibido en background)
    const onSWMessage = (e) => {
      if (e.data?.type === "PLAY_PUSH_SOUND") playSound();
    };
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSWMessage);
    }

    // (b) Mensaje en primer plano (la app está visible)
    let unsubscribeFg = () => {};
    try {
      unsubscribeFg = onForegroundMessage((payload) => {
        const data = payload?.data || {};
        if (data.playSound === true || data.playSound === "true") playSound();
      });
    } catch { /* firebase no configurado: ignore */ }

    return () => {
      window.removeEventListener("pointerdown", primeOnce);
      window.removeEventListener("keydown", primeOnce);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSWMessage);
      }
      try { unsubscribeFg(); } catch { /* ignore */ }
    };
  }, []);

  // Refresh user data from backend on mount (picks up photo changes, etc.)
  useEffect(() => {
    if (!token) return;
    const API = process.env.REACT_APP_BACKEND_URL;
    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(freshUser => {
        if (freshUser && freshUser.id) {
          const merged = { ...user, ...freshUser };
          localStorage.setItem("user", JSON.stringify(merged));
          setUser(merged);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // User state
  const isLoggedIn = !!token;
  const emailVerified = user?.email_verified || false;
  const hasSubdomain = !!user?.subdomain;
  const hasSchool = hasSubdomain;

  // Tenant context value
  const tenantValue = {
    subdomain: environment.subdomain || user?.subdomain,
    isSubdomainMode: environment.mode === 'subdomain',
    supportsWildcard: environment.supportsWildcard,
    getSchoolPath: (path) => {
      if (environment.supportsWildcard || environment.mode === 'subdomain') {
        return path;
      }
      const sub = user?.subdomain;
      return sub ? `/${sub}${path}` : path;
    },
    getSchoolUrl: (subdomain) => {
      if (environment.supportsWildcard) {
        return `https://${subdomain}.${BASE_DOMAIN}`;
      }
      return `${window.location.origin}/${subdomain}`;
    },
  };

  // Determine dashboard redirect path based on environment and role
  const getDashboardPath = () => {
    // If user has activePortal set (multi-role), route based on that
    const ap = activePortal || localStorage.getItem("active_portal");
    if (ap && ap !== user?.role && (user?.additional_roles || []).includes(ap)) {
      const portalPaths = {
        auxiliar_alimentacion: "/pae",
        auxiliar_movilidad: "/movilidad",
        auxiliar_asistencia: "/aux-asistencia",
      };
      const path = portalPaths[ap];
      if (path) {
        if (environment.mode === 'subdomain' || environment.supportsWildcard) return path;
        return user?.subdomain ? `/${user.subdomain}${path}` : path;
      }
    }

    // Global support users always go to /support
    if (isSupportGlobal(user)) {
      return '/support';
    }
    
    // Students get redirected to student portal
    if (isStudent(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/student';
      }
      return user?.subdomain ? `/${user.subdomain}/student` : '/student';
    }
    
    // Parents get redirected to parent portal
    if (isParent(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/parent';
      }
      return user?.subdomain ? `/${user.subdomain}/parent` : '/parent';
    }
    
    // Teachers get redirected to teacher portal
    if (isTeacher(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/teacher';
      }
      return user?.subdomain ? `/${user.subdomain}/teacher` : '/teacher';
    }
    
    // Psychologists get redirected to psychology portal
    if (isPsicologo(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/psicologia';
      }
      return user?.subdomain ? `/${user.subdomain}/psicologia` : '/psicologia';
    }
    
    // Auxiliar de Alimentación gets redirected to PAE dashboard
    if (isAuxiliarAlimentacion(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/pae';
      }
      return user?.subdomain ? `/${user.subdomain}/pae` : '/pae';
    }
    
    // Auxiliar de Movilidad gets redirected to Movilidad dashboard
    if (isAuxiliarMovilidad(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/movilidad';
      }
      return user?.subdomain ? `/${user.subdomain}/movilidad` : '/movilidad';
    }
    
    // Auxiliar de Asistencia gets redirected to their portal
    if (isAuxiliarAsistencia(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/aux-asistencia';
      }
      return user?.subdomain ? `/${user.subdomain}/aux-asistencia` : '/aux-asistencia';
    }

    // Auxiliar de Tópico (nurse) gets redirected to their dedicated dashboard
    if (isAuxiliarTopico(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/topico';
      }
      return user?.subdomain ? `/${user.subdomain}/topico` : '/topico';
    }
    
    // Coordinator gets redirected to Coordinacion dashboard
    if (isCoordinator(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/coordinacion';
      }
      return user?.subdomain ? `/${user.subdomain}/coordinacion` : '/coordinacion';
    }
    
    // Admin role uses the SAME Owner portal with RBAC restrictions
    if (isAdminOnly(user)) {
      if (environment.mode === 'subdomain' || environment.supportsWildcard) {
        return '/dashboard';
      }
      return user?.subdomain ? `/${user.subdomain}/dashboard` : '/dashboard';
    }
    
    // Default: regular dashboard (owner, director, coordinator, etc.)
    if (environment.mode === 'subdomain' || environment.supportsWildcard) {
      return '/dashboard';
    }
    return user?.subdomain ? `/${user.subdomain}/dashboard` : '/dashboard';
  };

  return (
    <ErrorBoundary>
    <TenantContext.Provider value={tenantValue}>
      <DemoModeProvider user={user}>
        <BrowserRouter>
          <SubscriptionProvider token={token}>
          <ShopifyRedirect user={user} environment={environment} />
          <ChatPalRouteGuard />
          <PageViewTracker />
          <GlobalSubscriptionOverlay token={token} user={user} />
        
        {showPortalSelector && user && (
          <PortalSelector user={user} onSelect={handlePortalSelect} />
        )}

        {!showPortalSelector && (
        <Routes>
          {/* ════════════════════════════════════════════════════════════════════
              PUBLIC ROUTES
          ════════════════════════════════════════════════════════════════════ */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={
            isLoggedIn ? (
              hasSchool ? <Navigate to={getDashboardPath()} replace /> :
              emailVerified ? <Navigate to="/onboarding" replace /> :
              <Navigate to="/verify-email" replace />
            ) : <RegisterPage />
          } />
          
          {/* ════════════════════════════════════════════════════════════════════
              LOGIN
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                isSupportGlobal(user) ? (
                  <Navigate to="/support" replace />
                ) : hasSubdomain ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : emailVerified ? (
                  <Navigate to="/onboarding" replace />
                ) : (
                  <Navigate to="/verify-email" replace />
                )
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              SCHOOL-SPECIFIC LOGIN (Branded login page)
              Pattern: /:subdomain/login
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/:subdomain/login"
            element={
              isLoggedIn && hasSubdomain ? (
                <Navigate to={getDashboardPath()} replace />
              ) : (
                <SchoolLoginPage onLogin={handleLogin} />
              )
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              EMAIL VERIFICATION
          ════════════════════════════════════════════════════════════════════ */}
          <Route path="/verify-email" element={<VerifyEmailPage onLogin={handleLogin} />} />
          
          {/* ════════════════════════════════════════════════════════════════════
              WELCOME
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/welcome"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={false} requireEmailVerified={true}>
                {hasSchool ? <Navigate to={getDashboardPath()} replace /> : <WelcomePage user={user} />}
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              ONBOARDING - Creates subdomain
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={false} requireEmailVerified={true}>
                {hasSchool ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <OnboardingPage token={token} user={user} onLogin={handleLogin} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              DASHBOARD - Direct path (for subdomain mode)
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isStudent(user) ? (
                  <Navigate to="/student" replace />
                ) : isTeacher(user) ? (
                  <Navigate to="/teacher" replace />
                ) : isPsicologo(user) ? (
                  <Navigate to="/psicologia" replace />
                ) : isAuxiliarAlimentacion(user) ? (
                  <Navigate to="/pae" replace />
                ) : isAuxiliarMovilidad(user) ? (
                  <Navigate to="/movilidad" replace />
                ) : isAuxiliarAsistencia(user) ? (
                  <Navigate to="/aux-asistencia" replace />
                ) : isAuxiliarTopico(user) ? (
                  <Navigate to="/topico" replace />
                ) : (
                  <DashboardPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              STUDENT PORTAL - Direct path (for subdomain mode)
              Note: Teachers and Admins are redirected to their respective portals
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/student"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentDashboardPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/courses"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/courses" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentCoursesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/courses/:courseId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/courses" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentCourseDetailPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/schedule"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentSchedulePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/exams"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentExamSchedulePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/tasks" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentTasksPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/grades"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/grades" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentGradesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/attendance" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentAttendancePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/messages" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentMessagesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/live-classes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <StudentLiveClassesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/profile"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to="/teacher/profile" replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to="/dashboard" replace />
                ) : (
                  <StudentProfilePage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
                )}
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              TEACHER PORTAL - Direct path (for subdomain mode)
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/teacher"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/courses"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherCoursesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/courses/:courseId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherCoursesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/students"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherStudentsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherAssignmentsViewPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/grades"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherGradesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherAttendancePage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherMessagesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/live-classes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherLiveClassesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/profile"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherProfilePage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherHealthPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/salud-bienestar/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherTopicoPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/salud-bienestar/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherPsicologiaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              PARENT PORTAL - Direct path (for subdomain mode)
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/parent"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentTasksPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/grades"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentGradesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentAttendancePage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/payments"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentPaymentsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/courses"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentCoursesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/courses/:courseId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentCourseDetailPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/schedule"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentSchedulePage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/exams"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentExamsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentMessagesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentHealthPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/psicologia-mensajes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentPsychMessagesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/profile"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentProfilePage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/registrar-alumno"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentEnrollmentForm user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/editar-hijo/:childId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentEnrollmentForm user={user} token={token} />
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              PSYCHOLOGY PORTAL - Direct path (for subdomain mode)
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/estudiantes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaEstudiantesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/fichas/:studentId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaFichaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/fichas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaFichasListPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/sesiones"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaSesionesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/perfil"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaPerfilPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/mensajes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaMensajesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/agenda"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaAgendaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/psicologia/talleres"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaTalleresPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              PAE (Programa de Alimentación Escolar) - Direct paths
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/pae"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PaeDashboard user={user} token={token} onLogout={handleLogout} onSwitchPortal={handleSwitchPortal} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pae/scanner"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PaeScanner user={user} token={token} />
              </ProtectedRoute>
            }
          />

          {/* Movilidad Portal - Direct paths */}
          <Route
            path="/movilidad"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MovilidadDashboard user={user} token={token} onLogout={handleLogout} onSwitchPortal={handleSwitchPortal} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/movilidad/scanner"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MovilidadScanner user={user} token={token} />
              </ProtectedRoute>
            }
          />

          {/* ════════════════════════════════════════════════════════════════════
              AUXILIAR DE ASISTENCIA - Direct paths
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/aux-asistencia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxAsistenciaDashboard user={user} token={token} onLogout={handleLogout} onSwitchPortal={handleSwitchPortal} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aux-asistencia/escanear"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxAsistenciaScanner user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aux-asistencia/mis-escaneos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxAsistenciaMisEscaneos user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aux-asistencia/asistencias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AttendancePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* ════════════════════════════════════════════════════════════════════
              ADMIN PORTAL REDIRECT - Admin uses Owner's dashboard with RBAC
              All /admin routes redirect to /dashboard for unified experience
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <Navigate to={getDashboardPath()} replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <Navigate to={getDashboardPath()} replace />
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              ADMIN PORTAL - Route based for school subdomain
              All admin routes redirect to owner's dashboard with RBAC
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/:subdomain/admin"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <Navigate to={getDashboardPath()} replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/*"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <Navigate to={getDashboardPath()} replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/teachers"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminTeachersPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/students"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdmin(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminStudentsPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/academic-structure"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminAcademicStructurePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/tutoring-overview"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdmin(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminTutoringOverviewPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/grades-management"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminGradesManagementPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminAttendancePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminTasksPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/exams"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminExamsPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          {/* Redirect legacy exam-schedule route to horarios (exam schedule is now a tab) */}
          <Route
            path="/:subdomain/admin/exam-schedule"
            element={<Navigate to="../horarios" replace />}
          />
          <Route
            path="/:subdomain/admin/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <SchedulePage user={user} token={token} onLogout={handleLogout} readOnly={false} showFilters={true} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/live-classes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminLiveClassesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminHealthPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/salud-bienestar/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminTopicoPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/salud-bienestar/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminPsicologiaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/settings"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminSettingsPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/branding"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminBrandingPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/announcements"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminAnnouncementsPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminMessagesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/admin/roles"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {!isAdminOnly(user) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <AdminRolesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              SCHOOL ROUTES - Route-based multi-tenancy (for preview/non-wildcard)
              Pattern: /school/:subdomain/dashboard/*
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/:subdomain/dashboard/*"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isStudent(user) ? (
                  <Navigate to={`/${user?.subdomain}/student`} replace />
                ) : isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher`} replace />
                ) : isPsicologo(user) ? (
                  <Navigate to={`/${user?.subdomain}/psicologia`} replace />
                ) : isAuxiliarAlimentacion(user) ? (
                  <Navigate to={`/${user?.subdomain}/pae`} replace />
                ) : isAuxiliarAsistencia(user) ? (
                  <Navigate to={`/${user?.subdomain}/aux-asistencia`} replace />
                ) : isAuxiliarTopico(user) ? (
                  <Navigate to={`/${user?.subdomain}/topico`} replace />
                ) : (
                  <SchoolDashboardRoute user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          
          {/* Student Portal - Route based */}
          <Route
            path="/:subdomain/student"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentDashboardPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/courses"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/courses`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentCoursesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/courses/:courseId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/courses`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentCourseDetailPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/schedule"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentSchedulePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/exams"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentExamSchedulePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/tasks`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentTasksPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/grades"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/grades`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentGradesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/attendance`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentAttendancePage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/messages`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentMessagesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/live-classes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <StudentLiveClassesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/student/profile"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {isTeacher(user) ? (
                  <Navigate to={`/${user?.subdomain}/teacher/profile`} replace />
                ) : isAdminOnly(user) ? (
                  <Navigate to={`/${user?.subdomain}/dashboard`} replace />
                ) : (
                  <StudentProfilePage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
                )}
              </ProtectedRoute>
            }
          />
          
          {/* Exam Taking Routes - Student */}
          <Route
            path="/:subdomain/exam/:examId/attempt"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ExamAttemptPage user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/exam/:examId/result/:attemptId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ExamResultPage user={user} token={token} />
              </ProtectedRoute>
            }
          />
          
          {/* Teacher Portal - Route based */}
          <Route
            path="/:subdomain/teacher"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/courses"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherCoursesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/courses/:courseId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherCoursesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/students"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherStudentsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherAssignmentsViewPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/grades"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherGradesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/observaciones"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherObservationsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherAttendancePage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherMessagesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/live-classes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherLiveClassesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/profile"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherProfilePage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherHealthPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/salud-bienestar/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherTopicoPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/salud-bienestar/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherPsicologiaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/teacher/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchedulePage user={user} token={token} onLogout={handleLogout} readOnly={true} showFilters={true} />
              </ProtectedRoute>
            }
          />
          
          {/* Psychology Portal - Route based */}
          <Route
            path="/:subdomain/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/estudiantes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaEstudiantesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/fichas/:studentId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaFichaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/fichas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaFichasListPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/sesiones"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaSesionesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/perfil"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaPerfilPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/mensajes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaMensajesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/agenda"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaAgendaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/psicologia/talleres"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaTalleresPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* PAE Portal - Route based (subdomain) */}
          <Route
            path="/:subdomain/pae"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PaeDashboard user={user} token={token} onLogout={handleLogout} onSwitchPortal={handleSwitchPortal} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/pae/scanner"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PaeScanner user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/pae/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchedulePage user={user} token={token} onLogout={handleLogout} readOnly={true} showFilters={true} />
              </ProtectedRoute>
            }
          />

          {/* Movilidad Portal - Route based (subdomain) */}
          <Route
            path="/:subdomain/movilidad"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MovilidadDashboard user={user} token={token} onLogout={handleLogout} onSwitchPortal={handleSwitchPortal} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/movilidad/scanner"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MovilidadScanner user={user} token={token} />
              </ProtectedRoute>
            }
          />

          {/* Auxiliar de Asistencia Portal - Route based (subdomain) */}
          <Route
            path="/:subdomain/aux-asistencia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxAsistenciaDashboard user={user} token={token} onLogout={handleLogout} onSwitchPortal={handleSwitchPortal} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/aux-asistencia/escanear"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxAsistenciaScanner user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/aux-asistencia/mis-escaneos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxAsistenciaMisEscaneos user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/aux-asistencia/asistencias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AttendancePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/aux-asistencia/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchedulePage user={user} token={token} onLogout={handleLogout} readOnly={true} showFilters={true} />
              </ProtectedRoute>
            }
          />

          {/* Coordinacion Portal - Route based (subdomain) */}
          <Route
            path="/:subdomain/coordinacion"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CoordinacionDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/incidencias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <IncidenciasListPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/incidencias/nueva"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <IncidenciaFormPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/incidencias/:id"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <IncidenciaDetailPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/derivaciones"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <DerivacionesListPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/derivaciones/:id"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <DerivacionDetailPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/reuniones"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ReunionesListPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/reuniones/:id"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ReunionDetailPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/estudiantes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <EstudiantesFichaPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/estudiantes/:studentId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <EstudiantesFichaPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/seguimientos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SeguimientosListPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/charlas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CharlasListPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/charlas/:id"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CharlaDetailPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/agenda"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AgendaPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/reportes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ReportesPage token={token} subdomain={user?.subdomain} user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/perfil"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CoordinacionPerfilPage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/coordinacion/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchedulePage user={user} token={token} onLogout={handleLogout} readOnly={true} showFilters={true} />
              </ProtectedRoute>
            }
          />

          {/* Parent Portal - Route based */}
          <Route
            path="/:subdomain/parent"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentDashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/coordinacion"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentCoordinacionView user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/tasks"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentTasksPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/grades"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentGradesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/attendance"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentAttendancePage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/payments"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentPaymentsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/courses"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentCoursesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/courses/:courseId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentCourseDetailPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/schedule"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentSchedulePage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/exams"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentExamsPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/messages"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentMessagesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentHealthPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/psicologia-mensajes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentPsychMessagesPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/profile"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentProfilePage user={user} token={token} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/registrar-alumno"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentEnrollmentForm user={user} token={token} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/parent/editar-hijo/:childId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ParentEnrollmentForm user={user} token={token} />
              </ProtectedRoute>
            }
          />
          
          {/* Settings Page - Route based */}
          <Route
            path="/:subdomain/settings"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SettingsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* Settings Page - Direct path (for subdomain mode) */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SettingsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* Plantilla Editor */}
          <Route
            path="/:subdomain/settings/registro-auxiliar/editor/:plantillaId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PlantillaEditorPage user={user} token={token} subdomain={user?.subdomain} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/settings/registro-auxiliar/nueva"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PlantillaEditorPage user={user} token={token} subdomain={user?.subdomain} />
              </ProtectedRoute>
            }
          />
          
          {/* Users Page - Route based */}
          <Route
            path="/:subdomain/users"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <UsersPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* Users Page - Direct path (for subdomain mode) */}
          <Route
            path="/users"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <UsersPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Academic Settings Page - Path-based (for preview mode) */}
          <Route
            path="/:subdomain/academic-settings"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AcademicSettingsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Academic Settings Page - Direct path (for subdomain mode) */}
          <Route
            path="/academic-settings"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AcademicSettingsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Áreas Curriculares — gestión MINEDU (path-based + subdomain) */}
          <Route
            path="/:subdomain/areas-curriculares"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminCurricularAreasPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/areas-curriculares"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminCurricularAreasPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Cierre de Bimestre — solo owner (snapshots de libretas por bimestre) */}
          <Route
            path="/:subdomain/cierre-bimestre"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminCierreBimestrePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cierre-bimestre"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AdminCierreBimestrePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Libreta Individual del Estudiante (Fase 3 - Turno F1) */}
          <Route
            path="/:subdomain/libreta/:student_id"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <LibretaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/libreta/:student_id"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <LibretaPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/:subdomain/mis-tutorias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MisTutoriasPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mis-tutorias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MisTutoriasPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Academic Years Page - Path-based (for preview mode) */}
          <Route
            path="/:subdomain/anos-academicos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AcademicYearsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Academic Years Page - Direct path (for subdomain mode) */}
          <Route
            path="/anos-academicos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AcademicYearsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Subjects Page - URL path mode */}
          <Route
            path="/:subdomain/asignaturas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SubjectsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Subjects Page - Direct path */}
          <Route
            path="/asignaturas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SubjectsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Teacher Assignments Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/asignacion-docente"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherAssignmentsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Teacher Assignments Page - Direct path (for subdomain mode) */}
          <Route
            path="/asignacion-docente"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TeacherAssignmentsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Consolidated Grades Page */}
          <Route
            path="/:subdomain/consolidado-notas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {(isStudent(user) || isParent(user)) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <ConsolidatedGradesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />
          <Route
            path="/consolidado-notas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {(isStudent(user) || isParent(user)) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <ConsolidatedGradesPage user={user} token={token} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />

          {/* Schedule Page - URL path mode (Spanish alias: horarios) */}
          <Route
            path="/:subdomain/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchedulePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Schedule Page - Direct path (for subdomain mode - Spanish alias) */}
          <Route
            path="/horarios"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchedulePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Messages Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/mensajes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MessagesPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Messages Page - Direct path (for subdomain mode) */}
          <Route
            path="/mensajes"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MessagesPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Attendance Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/asistencias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AttendancePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Attendance Page - Direct path (for subdomain mode) */}
          <Route
            path="/asistencias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AttendancePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* PAE - Registros del día dentro de Asistencias (admin/owner) */}
          <Route
            path="/:subdomain/asistencias/alimentacion"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AttendancePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} initialView="alimentacion" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/asistencias/alimentacion"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AttendancePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} initialView="alimentacion" />
              </ProtectedRoute>
            }
          />

          {/* Calendar Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/calendario"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CalendarPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Calendar Page - Direct path (for subdomain mode) */}
          <Route
            path="/calendario"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CalendarPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Surveys Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/encuestas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SurveysPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Surveys Page - Direct path (for subdomain mode) */}
          <Route
            path="/encuestas"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SurveysPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Health & Wellness Page - URL path mode */}
          <Route
            path="/:subdomain/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <HealthWellnessPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Health & Wellness Page - Direct path */}
          <Route
            path="/salud-bienestar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <HealthWellnessPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />


          {/* Tópico Page - URL path mode */}
          <Route
            path="/:subdomain/salud-bienestar/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TopicoPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Tópico dedicated dashboard for auxiliar_topico (nurse) role */}
          <Route
            path="/:subdomain/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxTopicoPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AuxTopicoPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Tópico Page - Direct path */}
          <Route
            path="/salud-bienestar/topico"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <TopicoPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />


          {/* Psicologia Page - URL path mode */}
          <Route
            path="/:subdomain/salud-bienestar/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Psicologia Page - Direct path */}
          <Route
            path="/salud-bienestar/psicologia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <PsicologiaPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />


          {/* Discipline Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/disciplina"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <DisciplinePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Discipline Page - Direct path (for subdomain mode) */}
          <Route
            path="/disciplina"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <DisciplinePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* News Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/noticias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <NewsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* News Page - Direct path (for subdomain mode) */}
          <Route
            path="/noticias"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <NewsPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Accounting Page - URL path mode (Spanish) */}
          <Route
            path="/:subdomain/contabilidad"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AccountingPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Accounting Page - Direct path (for subdomain mode) */}
          <Route
            path="/contabilidad"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AccountingPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Morosos Page */}
          <Route
            path="/:subdomain/morosos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MorososPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/morosos"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <MorososPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />


          {/* Course Detail Page - URL path mode */}
          <Route
            path="/:subdomain/curso/:subjectId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {(isStudent(user) || isParent(user)) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <CourseDetailPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />

          {/* Course Detail Page - Direct path */}
          <Route
            path="/curso/:subjectId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                {(isStudent(user) || isParent(user)) ? (
                  <Navigate to={getDashboardPath()} replace />
                ) : (
                  <CourseDetailPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
                )}
              </ProtectedRoute>
            }
          />

          {/* Academia Portal Page - URL path mode */}
          <Route
            path="/:subdomain/academia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AcademiaPortalPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/academia"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <AcademiaPortalPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Profile Page - URL path mode */}
          <Route
            path="/:subdomain/perfil"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ProfilePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />

          {/* Profile Page - Direct path */}
          <Route
            path="/perfil"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <ProfilePage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              TEMPORARY DIAGNOSTIC TOOL - Read-only, owner/support only
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/diag/registro-auxiliar"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={false} requireEmailVerified={false}>
                {(user?.is_owner || user?.role === "owner" || isSupportGlobal(user)) ? (
                  <DiagRegistroAuxiliarPage />
                ) : (
                  <Navigate to="/login" replace />
                )}
              </ProtectedRoute>
            }
          />

          {/* ════════════════════════════════════════════════════════════════════
              SUPPORT PANEL - Global support admin only
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/support"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={false} requireEmailVerified={false}>
                {isSupportGlobal(user) ? (
                  <SupportLayout user={user} token={token} onLogout={handleLogout} />
                ) : (
                  <Navigate to="/login" replace />
                )}
              </ProtectedRoute>
            }
          >
            <Route index element={<SupportDashboardPage token={token} />} />
            <Route path="schools" element={<SupportSchoolsPage token={token} onLogin={handleLogin} />} />
            <Route path="sessions" element={<SupportSessionsPage token={token} />} />
            <Route path="finances" element={<SupportFinancesPage token={token} />} />
            <Route path="pricing" element={<SupportPricingPage token={token} />} />
            <Route path="academia" element={<SupportAcademiaPage token={token} />} />
            <Route path="demos" element={<SupportDemosPage token={token} />} />
            <Route path="diagnostico" element={<SupportDiagnosticsPage />} />
            <Route path="profile" element={<SupportProfilePage token={token} user={user} onUserUpdate={handleUserUpdate} />} />
            <Route path="*" element={<Navigate to="/support" replace />} />
          </Route>
          
          {/* ════════════════════════════════════════════════════════════════════
              BACKWARD COMPATIBILITY - Redirect old /school/:subdomain/* to /:subdomain/*
          ════════════════════════════════════════════════════════════════════ */}
          <Route path="/school/:subdomain/*" element={<SchoolRedirect />} />
          
          {/* ════════════════════════════════════════════════════════════════════
              SHORT URL - /:subdomain goes directly to login
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/:subdomain"
            element={
              isLoggedIn && hasSubdomain ? (
                <Navigate to={getDashboardPath()} replace />
              ) : (
                <SchoolLoginPage onLogin={handleLogin} />
              )
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              404
          ════════════════════════════════════════════════════════════════════ */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        )}
          </SubscriptionProvider>
        <BirthdayPopupCarousel token={token} user={user} />
      </BrowserRouter>
      </DemoModeProvider>
      <Toaster position="top-right" richColors closeButton />
    </TenantContext.Provider>
    </ErrorBoundary>
  );
}

export default App;
