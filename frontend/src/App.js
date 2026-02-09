import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import WelcomePage from "@/pages/WelcomePage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";
import NotFoundPage from "@/pages/NotFoundPage";

const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || "edunet.pe";

// ══════════════════════════════════════════════════════════════════════════════
// SHOPIFY RULE: Redirect to subdomain if user has one
// ══════════════════════════════════════════════════════════════════════════════

function ShopifyRedirect({ user }) {
  const location = useLocation();
  
  useEffect(() => {
    // If user has subdomain and we're on main domain, redirect to subdomain
    if (user?.subdomain) {
      const currentHost = window.location.hostname.toLowerCase();
      const isMainDomain = currentHost === BASE_DOMAIN || 
                           currentHost === `www.${BASE_DOMAIN}` ||
                           currentHost.includes('preview.emergentagent.com');
      
      // In production, would redirect to actual subdomain
      // For now in preview, we'll handle it via routing
      if (isMainDomain && !location.pathname.startsWith('/dashboard')) {
        console.log(`[Shopify Rule] User has subdomain: ${user.subdomain}`);
        // In production: window.location.href = `https://${user.subdomain}.${BASE_DOMAIN}`;
      }
    }
  }, [user, location]);
  
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// Protected Route Component
// ══════════════════════════════════════════════════════════════════════════════

function ProtectedRoute({ children, token, user, requireSchool = false, requireEmailVerified = true }) {
  const location = useLocation();
  
  // Not logged in -> redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Email not verified -> redirect to verify
  if (requireEmailVerified && user && !user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }
  
  // School required but user has no subdomain -> redirect to onboarding
  // IMPORTANT: Check for subdomain, not just school_id (legacy users may have school_id but no subdomain)
  if (requireSchool && user && !user.subdomain) {
    // User must create subdomain first
    return <Navigate to="/onboarding" replace />;
  }
  
  return children;
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

  // Determine user state
  // IMPORTANT: A user has completed onboarding ONLY if they have BOTH school_id AND subdomain
  // Having school_id but no subdomain means they have a legacy/pending school record
  const isLoggedIn = !!token;
  const emailVerified = user?.email_verified || false;
  const hasSubdomain = !!user?.subdomain;
  // hasSchool = true ONLY if user has completed onboarding (has subdomain)
  const hasSchool = hasSubdomain;

  return (
    <BrowserRouter>
      {/* Shopify Rule: Auto-redirect to subdomain */}
      <ShopifyRedirect user={user} />
      
      <Routes>
        {/* ════════════════════════════════════════════════════════════════════
            PUBLIC ROUTES
        ════════════════════════════════════════════════════════════════════ */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={
          isLoggedIn ? (
            hasSchool ? <Navigate to="/dashboard" replace /> :
            emailVerified ? <Navigate to="/onboarding" replace /> :
            <Navigate to="/verify-email" replace />
          ) : <RegisterPage />
        } />
        
        {/* ════════════════════════════════════════════════════════════════════
            LOGIN - With Shopify redirect logic
        ════════════════════════════════════════════════════════════════════ */}
        <Route
          path="/login"
          element={
            isLoggedIn ? (
              // SHOPIFY RULE: If user has subdomain, they should be on their subdomain
              hasSubdomain ? (
                // In production: redirect to subdomain
                // For preview: go to dashboard
                <Navigate to="/dashboard" replace />
              ) : hasSchool ? (
                <Navigate to="/dashboard" replace />
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
            EMAIL VERIFICATION
        ════════════════════════════════════════════════════════════════════ */}
        <Route
          path="/verify-email"
          element={<VerifyEmailPage onLogin={handleLogin} />}
        />
        
        {/* ════════════════════════════════════════════════════════════════════
            WELCOME (After email verification, before onboarding)
        ════════════════════════════════════════════════════════════════════ */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute token={token} user={user} requireSchool={false} requireEmailVerified={true}>
              {hasSchool ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <WelcomePage user={user} />
              )}
            </ProtectedRoute>
          }
        />
        
        {/* ════════════════════════════════════════════════════════════════════
            ONBOARDING - MANDATORY before dashboard
            User CANNOT skip this if school_id is null
        ════════════════════════════════════════════════════════════════════ */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute token={token} user={user} requireSchool={false} requireEmailVerified={true}>
              {hasSchool ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <OnboardingPage token={token} user={user} onLogin={handleLogin} />
              )}
            </ProtectedRoute>
          }
        />
        
        {/* ════════════════════════════════════════════════════════════════════
            DASHBOARD - REQUIRES school_id
            User CANNOT access if school_id is null
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
            404 / CATCH-ALL
        ════════════════════════════════════════════════════════════════════ */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
