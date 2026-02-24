import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, Mail, GraduationCap, ArrowLeft, AtSign } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BASE_DOMAIN = process.env.REACT_APP_BASE_DOMAIN || "edunet.pe";

export default function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login`, { email, password });
      const { token, user, redirect_to_subdomain, redirect_url, redirect_to_support } = res.data;
      
      // Save to state and localStorage
      onLogin(token, user);
      
      // Global support user -> redirect to /support
      if (redirect_to_support || user.role === "system_admin_global" || user.is_support_global) {
        navigate("/support");
      } else if (redirect_to_subdomain && redirect_url) {
        // In production, this would redirect to the actual subdomain
        // window.location.href = redirect_url;
        
        // For preview environment, navigate to dashboard
        console.log(`[Shopify Rule] Would redirect to: ${redirect_url}`);
        navigate("/dashboard");
      } else if (user.school_id) {
        // Has school but checking redirect
        navigate("/dashboard");
      } else if (user.email_verified) {
        // Email verified but no school - must create subdomain
        navigate("/onboarding");
      } else {
        // Email not verified
        navigate("/verify-email");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 px-6" data-testid="login-page">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#5c85d6]/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#e1b82c]/10 blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        {/* Back to home */}
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-[#001f4b] transition-colors group mb-8"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Volver al inicio
        </Link>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 xl:p-10 border border-slate-100" data-testid="login-card">
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <Link to="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#001f4b] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
              </div>
              <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                EduNet
              </span>
            </Link>
            <h1 className="text-2xl font-extrabold text-[#001f4b] tracking-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Inicia Sesión
            </h1>
            <p className="text-sm text-slate-500 mt-1">Accede a tu intranet escolar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl" data-testid="login-error">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Email o nombre de usuario</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  data-testid="login-email-input"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                  placeholder="tu@email.com o tu_usuario"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  data-testid="login-password-input"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                  placeholder="Tu contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  data-testid="toggle-password"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-[#001f4b] to-[#0a3068] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-900/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿No tienes cuenta?{" "}
            <Link to="/register" className="font-semibold text-[#001f4b] hover:underline" data-testid="login-register-link">
              Crea una gratis
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          EduNet &copy; 2026 — Intranet para colegios
        </p>
      </div>
    </div>
  );
}
