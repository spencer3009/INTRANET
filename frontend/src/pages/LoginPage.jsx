import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, GraduationCap, AtSign } from "lucide-react";
import InstallGateway from "../components/InstallGateway";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function LoginForm({ onLogin }) {
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
      const { token, user } = res.data;
      onLogin(token, user);
      if (user.subdomain) localStorage.setItem("edunet_last_school", user.subdomain);
      if (res.data.redirect_to_support || user.role === "system_admin_global" || user.is_support_global) {
        navigate("/support");
      } else if (user.school_id) {
        navigate("/dashboard");
      } else if (user.email_verified) {
        navigate("/onboarding");
      } else {
        navigate("/verify-email");
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "linear-gradient(135deg, #001636dd 0%, #001f4b 50%, #0a3068ee 100%)" }}
      data-testid="login-page"
    >
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-10 blur-3xl bg-[#e1b82c]" />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full opacity-10 blur-3xl bg-[#e1b82c]" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white rounded-3xl shadow-2xl p-8 xl:p-10" data-testid="login-card">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center mb-4 shadow-lg">
              <GraduationCap className="w-10 h-10 text-[#001f4b]" />
            </div>
            <h1 className="text-2xl font-extrabold text-[#001f4b] tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              EduNet
            </h1>
            <p className="text-sm text-slate-500 mt-1">Intranet escolar</p>
          </div>

          <p className="text-sm text-slate-500 text-center mb-6">Accede a tu intranet escolar</p>

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
              <label className="block text-sm font-semibold text-slate-600 mb-2">Contrasena</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  data-testid="login-password-input"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                  placeholder="Tu contrasena"
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
              className="w-full py-4 bg-[#001f4b] text-white font-bold rounded-xl hover:bg-[#0a3068] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ boxShadow: loading ? "none" : "0 10px 30px -10px rgba(0,31,75,0.5)" }}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-2 mt-6 text-white/40">
          <GraduationCap className="w-4 h-4" />
          <span className="text-xs">Powered by EduNet</span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage({ onLogin }) {
  return (
    <InstallGateway>
      <LoginForm onLogin={onLogin} />
    </InstallGateway>
  );
}
