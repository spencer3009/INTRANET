import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import WelcomePage from "@/pages/WelcomePage";
import OnboardingPage from "@/pages/OnboardingPage";
import DashboardPage from "@/pages/DashboardPage";

// Component to protect routes and enforce onboarding
function ProtectedRoute({ children, token, user, requireOnboarding = true }) {
  const location = useLocation();
  
  // Not logged in -> redirect to login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Logged in but hasn't completed onboarding -> redirect to onboarding
  // (except if we're already on onboarding or welcome page)
  if (requireOnboarding && user && !user.onboarding_complete) {
    const allowedPaths = ['/onboarding', '/welcome', '/verify-email'];
    if (!allowedPaths.includes(location.pathname)) {
      return <Navigate to="/welcome" replace />;
    }
  }
  
  return children;
}

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

  // Check if user needs to complete onboarding
  const needsOnboarding = token && user && !user.onboarding_complete;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage onLogin={handleLogin} />} />
        
        {/* Login - redirect to appropriate place based on onboarding status */}
        <Route
          path="/login"
          element={
            token ? (
              needsOnboarding ? (
                <Navigate to="/welcome" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />
        
        {/* Welcome - requires auth but not onboarding */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute token={token} user={user} requireOnboarding={false}>
              <WelcomePage user={user} />
            </ProtectedRoute>
          }
        />
        
        {/* Onboarding - requires auth but not onboarding completion */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute token={token} user={user} requireOnboarding={false}>
              <OnboardingPage token={token} user={user} onLogin={handleLogin} />
            </ProtectedRoute>
          }
        />
        
        {/* Dashboard - requires auth AND completed onboarding */}
        <Route
          path="/dashboard/*"
          element={
            <ProtectedRoute token={token} user={user} requireOnboarding={true}>
              <DashboardPage user={user} token={token} onLogout={handleLogout} />
            </ProtectedRoute>
          }
        />
        
        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
