import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, GraduationCap, ArrowLeft, AtSign, LogIn, Globe } from "lucide-react";
import PwaInstallPrompt from "../components/PwaInstallPrompt";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const { token, user, redirect_to_subdomain, redirect_url, redirect_to_support } = res.data;
      
      onLogin(token, user);

      // Save last school for PWA auto-redirect
      if (user.subdomain) {
        localStorage.setItem('edunet_last_school', user.subdomain);
      }
      
      if (redirect_to_support || user.role === "system_admin_global" || user.is_support_global) {
        navigate("/support");
      } else if (redirect_to_subdomain && redirect_url) {
        console.log(`[Redirect] Would redirect to: ${redirect_url}`);
        navigate("/dashboard");
      } else if (user.school_id) {
        navigate("/dashboard");
      } else if (user.email_verified) {
        navigate("/onboarding");
      } else {
        navigate("/verify-email");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'linear-gradient(135deg, #001636dd 0%, #001f4b 50%, #0a3068ee 100%)' }}
      data-testid="login-page"
    >
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10 blur-3xl bg-[#e1b82c]" />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#e1b82c]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8 xl:p-10" data-testid="login-card">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-4 shadow-lg">
              <GraduationCap className="w-10 h-10 text-[#001f4b]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#001f4b] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              EduNet
            </h1>
            <p className="text-sm text-slate-500 mt-1">Intranet escolar</p>
          </div>

          {/* Mobile: show install screen first, unless already installed as PWA */}
          {isMobile && !showLoginForm ? (
            (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) ? (
              <>
                <p className="text-sm text-slate-500 text-center mb-6">Accede a tu intranet escolar</p>
                {renderLoginForm()}
              </>
            ) : (
              <div data-testid="mobile-install-view">
                <PwaInstallPrompt mode="hero" />

                <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                  <button
                    onClick={() => setShowLoginForm(true)}
                    className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                    data-testid="show-login-btn"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Abrir en el navegador
                  </button>
                </div>
              </div>
            )
          ) : (
            <>
              <p className="text-sm text-slate-500 text-center mb-6">Accede a tu intranet escolar</p>
              {renderLoginForm()}
              {!isMobile && <PwaInstallPrompt />}
            </>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-white/40">
          <GraduationCap className="w-4 h-4" />
          <span className="text-xs">Powered by EduNet</span>
        </div>
      </div>
    </div>
  );
}
