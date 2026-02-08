import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Eye, EyeOff, Lock, Mail, GraduationCap } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LoginPage({ onLogin }) {
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
      onLogin(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg flex items-center justify-center min-h-screen px-4">
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#5c85d6]/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#e1b82c]/10 blur-3xl" />

      <div className="login-card w-full max-w-md p-10 relative z-10" data-testid="login-card">
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Correo electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                data-testid="login-email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                placeholder="admin@elroble.edu"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                data-testid="login-password-input"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                placeholder="Ingrese su contraseña"
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
            className="w-full py-3 bg-[#001f4b] text-white font-semibold rounded-xl hover:bg-[#001f4b]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          Colegio El Roble &copy; 2026 — Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}
