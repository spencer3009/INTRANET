import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Eye,
  EyeOff,
  GraduationCap,
  Users,
  BarChart3,
  Shield,
  MessageSquare,
  ArrowLeft,
  UserPlus,
  Check,
  X,
  Sparkles,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const features = [
  { icon: Users, title: "Comunidad Conectada", desc: "Padres, docentes y directivos en un solo lugar" },
  { icon: BarChart3, title: "Reportes Inteligentes", desc: "Métricas de asistencia y calificaciones al instante" },
  { icon: MessageSquare, title: "Comunicación Eficaz", desc: "Mensajería institucional sin WhatsApp" },
  { icon: Shield, title: "Datos Seguros", desc: "Encriptación y control de acceso por roles" },
];

// Password strength calculator
const getPasswordStrength = (password) => {
  if (!password) return { level: 0, label: "", color: "bg-slate-200" };
  
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  if (score <= 2) return { level: 1, label: "Muy débil", color: "bg-red-500", textColor: "text-red-600" };
  if (score <= 3) return { level: 2, label: "Débil", color: "bg-orange-500", textColor: "text-orange-600" };
  if (score <= 5) return { level: 3, label: "Media", color: "bg-yellow-500", textColor: "text-yellow-600" };
  if (score <= 6) return { level: 4, label: "Fuerte", color: "bg-emerald-500", textColor: "text-emerald-600" };
  return { level: 5, label: "Muy fuerte", color: "bg-emerald-600", textColor: "text-emerald-700" };
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    school_name: "",
    email: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const passwordStrength = getPasswordStrength(form.password);
  const passwordsMatch = form.password && confirmPassword && form.password === confirmPassword;
  const passwordsMismatch = form.password && confirmPassword && form.password !== confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.school_name || !form.email || !form.password) {
      setError("Por favor completa todos los campos");
      return;
    }
    
    // Validate password strength
    if (passwordStrength.level <= 1) {
      setError("La contraseña es muy débil. Usa al menos 6 caracteres con mayúsculas, minúsculas y números.");
      return;
    }

    // Validate password confirmation
    if (!confirmPassword) {
      setError("Debes confirmar la contraseña");
      return;
    }

    if (form.password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/register`, {
        school_name: form.school_name,
        email: form.email,
        password: form.password,
      });
      navigate("/verify-email", {
        state: {
          email: form.email,
          code: res.data.verification_code,
          school_name: form.school_name,
        },
      });
    } catch (err) {
      setError(err.response?.data?.detail || "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" data-testid="register-page">
      {/* ═══════════════════════════════════════════════════════════════════════
          LEFT PANEL - Wider, gradient background, glass cards
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] relative overflow-hidden flex-col justify-between p-12 xl:p-16">
        {/* Decorative blurs */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full bg-[#e1b82c]/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl" />
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        {/* Content */}
        <div className="relative z-10">
          {/* Brand logo */}
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl px-4 py-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-[#e1b82c] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#001f4b]" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              EduNet
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>
            Crea la intranet<br />
            <span className="text-[#e1b82c]">de tu colegio</span>
          </h1>
          
          <p className="text-lg text-blue-100/80 leading-relaxed max-w-lg mb-12">
            En 3 simples pasos tendrás tu propia plataforma educativa con subdominio personalizado.
          </p>

          {/* Feature cards - Glass effect */}
          <div className="grid grid-cols-2 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white/[0.08] backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/[0.12] transition-all duration-300 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
                    <Icon className="w-5 h-5 text-blue-200" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1.5">{f.title}</h3>
                  <p className="text-sm text-blue-200/60 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Social proof footer */}
        <div className="relative z-10 flex items-center gap-8 pt-8 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-200/60" />
            <span className="text-sm font-semibold text-white">+120 colegios activos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((i) => (
                <svg key={i} className="w-4 h-4 fill-[#e1b82c] text-[#e1b82c]" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-white">4.9</span>
            <span className="text-sm text-blue-200/60">valoración</span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT PANEL - Registration form (SIMPLIFIED: 3 fields)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 flex flex-col min-h-screen">
        {/* Back button */}
        <div className="p-6 xl:p-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-[#001f4b] transition-colors group"
            data-testid="register-back-btn"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver al inicio
          </Link>
        </div>

        {/* Centered form container */}
        <div className="flex-1 flex items-center justify-center px-6 xl:px-12 pb-8">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-xl bg-[#001f4b] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
              </div>
              <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
                EduNet
              </span>
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 xl:p-10 border border-slate-100">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#001f4b] to-[#0a3068] flex items-center justify-center shadow-lg shadow-blue-900/25">
                  <UserPlus className="w-8 h-8 text-white" />
                </div>
              </div>

              {/* Title */}
              <h1
                className="text-2xl font-bold text-slate-800 text-center mb-2"
                style={{ fontFamily: "Manrope, sans-serif" }}
                data-testid="register-title"
              >
                Crea tu cuenta
              </h1>
              <p className="text-sm text-slate-400 text-center mb-8">
                Paso 1 de 3 · Empieza gratis
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center" data-testid="register-error">
                    {error}
                  </div>
                )}

                {/* School name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    Nombre del colegio
                  </label>
                  <input
                    data-testid="register-school-name"
                    type="text"
                    value={form.school_name}
                    onChange={(e) => update("school_name", e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="Ej: Colegio El Roble"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    Correo electrónico
                  </label>
                  <input
                    data-testid="register-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      data-testid="register-password"
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      className="w-full px-4 pr-11 py-3.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      data-testid="register-toggle-password"
                    >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Password strength indicator */}
                  {form.password && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 flex-1 rounded-full transition-all ${
                              level <= passwordStrength.level ? passwordStrength.color : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`text-xs font-medium ${passwordStrength.textColor}`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <input
                      data-testid="register-confirm-password"
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full px-4 pr-11 py-3.5 bg-slate-50/80 border rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 transition-all placeholder:text-slate-400 ${
                        passwordsMismatch
                          ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                          : passwordsMatch
                          ? 'border-emerald-300 focus:ring-emerald-500/20 focus:border-emerald-500'
                          : 'border-slate-200 focus:ring-[#001f4b]/20 focus:border-[#001f4b]'
                      } focus:bg-white`}
                      placeholder="Repite la contraseña"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass(!showConfirmPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showConfirmPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  
                  {/* Match indicator */}
                  {confirmPassword && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {passwordsMatch ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs font-medium text-emerald-600">Las contraseñas coinciden</span>
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 text-red-500" />
                          <span className="text-xs font-medium text-red-600">Las contraseñas no coinciden</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Submit */}
                <button
                  data-testid="register-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-[#001f4b] to-[#0a3068] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-900/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Continuar
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </form>

              {/* Login link */}
              <p className="text-center text-sm text-slate-500 mt-6">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="font-semibold text-[#001f4b] hover:underline" data-testid="register-login-link">
                  Inicia sesión
                </Link>
              </p>
            </div>

            {/* Terms */}
            <p className="text-center text-xs text-slate-400 mt-6">
              Al continuar aceptas los{" "}
              <span className="text-blue-500 cursor-pointer hover:underline">Términos</span>{" "}
              y la{" "}
              <span className="text-blue-500 cursor-pointer hover:underline">Privacidad</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
