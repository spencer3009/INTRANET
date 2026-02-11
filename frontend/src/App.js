import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
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
import AcademicSettingsPage from "@/pages/AcademicSettingsPage";
import SubjectsPage from "@/pages/SubjectsPage";
import SchedulePage from "@/pages/SchedulePage";
import MessagesPage from "@/pages/MessagesPage";
import AttendancePage from "@/pages/AttendancePage";
import CalendarPage from "@/pages/CalendarPage";
import SurveysPage from "@/pages/SurveysPage";
import DisciplinePage from "@/pages/DisciplinePage";
import NewsPage from "@/pages/NewsPage";
import AccountingPage from "@/pages/AccountingPage";
import CourseDetailPage from "@/pages/CourseDetailPage";
import NotFoundPage from "@/pages/NotFoundPage";

const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || "edunet.pe";

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

function ShopifyRedirect({ user, environment }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!user?.subdomain) return;
    
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
    const schoolPrefix = `/school/${user.subdomain}`;
    if (!location.pathname.startsWith(schoolPrefix) && !location.pathname.startsWith('/school/')) {
      // Only redirect to school route if trying to access dashboard
      if (location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/')) {
        const newPath = `${schoolPrefix}${location.pathname}`;
        console.log(`[Shopify Rule] Redirecting to school route: ${newPath}`);
        navigate(newPath, { replace: true });
      }
    }
  }, [user, environment, location, navigate]);
  
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Protected Route Component
// ══════════════════════════════════════════════════════════════════════════════

function ProtectedRoute({ children, token, user, requireSchool = false, requireEmailVerified = true }) {
  const location = useLocation();
  
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (requireEmailVerified && user && !user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  if (requireSchool && user && !user.subdomain) {
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
}

// ══════════════════════════════════════════════════════════════════════════════
// School Routes Wrapper - Handles /school/:subdomain/* routes
// ══════════════════════════════════════════════════════════════════════════════

function SchoolDashboardRoute({ user, token, onLogout }) {
  const { subdomain } = useParams();
  
  // Verify user has access to this school
  if (user?.subdomain !== subdomain) {
    return <NotFoundPage message={`No tienes acceso a ${subdomain}.${BASE_DOMAIN}`} />;
  }
  
  return <DashboardPage user={user} token={token} onLogout={onLogout} routeSubdomain={subdomain} />;
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

  const handleLogin = (tokenVal, userData) => {
    localStorage.setItem("token", tokenVal);
    localStorage.setItem("user", JSON.stringify(userData));
    setToken(tokenVal);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken("");
    setUser(null);
  };

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
        return path; // Use path as-is for subdomain mode
      }
      // Route mode: prepend /school/{subdomain}
      const sub = user?.subdomain;
      return sub ? `/school/${sub}${path}` : path;
    },
    getSchoolUrl: (subdomain) => {
      if (environment.supportsWildcard) {
        return `https://${subdomain}.${BASE_DOMAIN}`;
      }
      // Route mode: use current origin with school route
      return `${window.location.origin}/school/${subdomain}`;
    },
  };

  // Determine dashboard redirect path based on environment
  const getDashboardPath = () => {
    if (environment.mode === 'subdomain' || environment.supportsWildcard) {
      return '/dashboard';
    }
    return user?.subdomain ? `/school/${user.subdomain}/dashboard` : '/dashboard';
  };

  return (
    <TenantContext.Provider value={tenantValue}>
      <BrowserRouter>
        <ShopifyRedirect user={user} environment={environment} />
        
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
                hasSubdomain ? (
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
              Pattern: /school/:subdomain/login
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/school/:subdomain/login"
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
                <DashboardPage user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              SCHOOL ROUTES - Route-based multi-tenancy (for preview/non-wildcard)
              Pattern: /school/:subdomain/dashboard/*
          ════════════════════════════════════════════════════════════════════ */}
          <Route
            path="/school/:subdomain/dashboard/*"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <SchoolDashboardRoute user={user} token={token} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* Settings Page - Route based */}
          <Route
            path="/school/:subdomain/settings"
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
          
          {/* Users Page - Route based */}
          <Route
            path="/school/:subdomain/users"
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
            path="/school/:subdomain/academic-settings"
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

          {/* Subjects Page - URL path mode */}
          <Route
            path="/school/:subdomain/asignaturas"
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

          {/* Schedule Page - URL path mode (Spanish alias: horarios) */}
          <Route
            path="/school/:subdomain/horarios"
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
            path="/school/:subdomain/mensajes"
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
            path="/school/:subdomain/asistencias"
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

          {/* Calendar Page - URL path mode (Spanish) */}
          <Route
            path="/school/:subdomain/calendario"
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
            path="/school/:subdomain/encuestas"
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

          {/* Discipline Page - URL path mode (Spanish) */}
          <Route
            path="/school/:subdomain/disciplina"
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
            path="/school/:subdomain/noticias"
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
            path="/school/:subdomain/contabilidad"
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

          {/* Course Detail Page - URL path mode */}
          <Route
            path="/school/:subdomain/curso/:subjectId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CourseDetailPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          {/* Course Detail Page - Direct path */}
          <Route
            path="/curso/:subjectId"
            element={
              <ProtectedRoute token={token} user={user} requireSchool={true} requireEmailVerified={true}>
                <CourseDetailPage user={user} token={token} subdomain={user?.subdomain} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
          
          {/* Redirect /school/:subdomain to /school/:subdomain/dashboard */}
          <Route
            path="/school/:subdomain"
            element={<Navigate to="dashboard" replace />}
          />
          
          {/* ════════════════════════════════════════════════════════════════════
              404
          ════════════════════════════════════════════════════════════════════ */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </TenantContext.Provider>
  );
}

export default App;
