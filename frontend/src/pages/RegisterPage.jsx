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
  ChevronDown,
  ArrowLeft,
  UserPlus,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const features = [
  { icon: Users, title: "Comunidad Conectada", desc: "Padres, docentes y directivos en un solo lugar" },
  { icon: BarChart3, title: "Reportes Inteligentes", desc: "Métricas de asistencia y calificaciones al instante" },
  { icon: MessageSquare, title: "Comunicación Eficaz", desc: "Mensajería institucional sin WhatsApp" },
  { icon: Shield, title: "Datos Seguros", desc: "Encriptación y control de acceso por roles" },
];

const roles = ["Director(a)", "Administrador(a)", "Coordinador(a)", "Otro"];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    school_name: "",
    contact_name: "",
    role: "",
    custom_role: "",
    email: "",
    whatsapp: "",
    password: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const finalRole = form.role === "Otro" ? form.custom_role : form.role;

    if (!form.school_name || !form.contact_name || !finalRole || !form.email || !form.password) {
      setError("Por favor completa todos los campos obligatorios");
      return;
    }
    if (form.role === "Otro" && !form.custom_role.trim()) {
      setError("Por favor especifica tu cargo");
      return;
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        school_name: form.school_name,
        contact_name: form.contact_name,
        role: finalRole,
        email: form.email,
        password: form.password,
        phone: form.whatsapp ? `+51${form.whatsapp}` : "",
      };
      const res = await axios.post(`${API}/schools/register`, payload);
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

  // WhatsApp icon component
  const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );

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
              <GraduationCap className="w-5 h-5 text-[#1e40af]" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              EduNet
            </span>
          </div>

          {/* Main headline */}
          <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-tight mb-6" style={{ fontFamily: "Manrope, sans-serif" }}>
            Digitaliza tu colegio,<br />
            <span className="text-[#e1b82c]">potencia tu gestión</span>
          </h1>
          
          <p className="text-lg text-blue-100/80 leading-relaxed max-w-lg mb-12">
            La plataforma de intranet escolar más intuitiva para directores y equipos administrativos en Perú.
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
          RIGHT PANEL - Registration form
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30 flex flex-col min-h-screen">
        {/* Back button */}
        <div className="p-6 xl:p-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-[#1e40af] transition-colors group"
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
              <div className="w-10 h-10 rounded-xl bg-[#1e40af] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
              </div>
              <span className="text-xl font-extrabold text-[#1e40af]" style={{ fontFamily: "Manrope" }}>
                EduNet
              </span>
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 p-8 xl:p-10 border border-slate-100">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#3b82f6] flex items-center justify-center shadow-lg shadow-blue-500/25">
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
                Empieza gratis, sin tarjeta de crédito
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
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
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="Ej: Colegio El Roble"
                    required
                  />
                </div>

                {/* Contact name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    Nombre completo
                  </label>
                  <input
                    data-testid="register-contact-name"
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => update("contact_name", e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="Tu nombre completo"
                    required
                  />
                </div>

                {/* Role select */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    Cargo
                  </label>
                  <button
                    type="button"
                    onClick={() => setRoleOpen(!roleOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all"
                    data-testid="register-role-select"
                  >
                    <span className={form.role ? "text-slate-800" : "text-slate-400"}>
                      {form.role || "Selecciona tu cargo"}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${roleOpen ? "rotate-180" : ""}`} />
                  </button>
                  {roleOpen && (
                    <div className="absolute z-20 mt-2 w-full bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden">
                      {roles.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => { update("role", r); setRoleOpen(false); }}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors ${form.role === r ? "bg-blue-50 font-medium text-blue-600" : "text-slate-700"}`}
                          data-testid={`role-option-${r}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Custom role input */}
                {form.role === "Otro" && (
                  <div className="animate-fadeIn">
                    <label className="block text-sm font-semibold text-slate-600 mb-2">
                      Especifica tu cargo
                    </label>
                    <input
                      data-testid="register-custom-role"
                      type="text"
                      value={form.custom_role}
                      onChange={(e) => update("custom_role", e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                      placeholder="Ej: Secretario(a) Académico(a)"
                      required
                    />
                  </div>
                )}

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
                    className="w-full px-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-semibold text-slate-600 mb-2">
                    WhatsApp <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 shrink-0">
                      <span className="text-base">🇵🇪</span>
                      <span>+51</span>
                    </div>
                    <div className="relative flex-1">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600">
                        <WhatsAppIcon />
                      </div>
                      <input
                        data-testid="register-whatsapp"
                        type="tel"
                        value={form.whatsapp}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          update("whatsapp", value);
                        }}
                        maxLength={9}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                        placeholder="999 999 999"
                      />
                    </div>
                  </div>
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
                      className="w-full px-4 pr-11 py-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
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
                </div>

                {/* Submit */}
                <button
                  data-testid="register-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Crear mi cuenta
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">o continúa con</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Social login buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button className="flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              </div>

              {/* Login link */}
              <p className="text-center text-sm text-slate-500 mt-6">
                ¿Ya tienes cuenta?{" "}
                <Link to="/login" className="font-semibold text-[#1e40af] hover:underline" data-testid="register-login-link">
                  Inicia sesión
                </Link>
              </p>
            </div>

            {/* Terms */}
            <p className="text-center text-xs text-slate-400 mt-6">
              Al crear tu cuenta aceptas los{" "}
              <span className="text-blue-500 cursor-pointer hover:underline">Términos</span>{" "}
              y la{" "}
              <span className="text-blue-500 cursor-pointer hover:underline">Privacidad</span>
            </p>
          </div>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
