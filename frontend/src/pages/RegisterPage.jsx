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

const valueProps = [
  { icon: Users, title: "Comunidad Conectada", desc: "Padres, docentes y directivos en un solo lugar" },
  { icon: BarChart3, title: "Reportes Inteligentes", desc: "Métricas de asistencia y calificaciones" },
  { icon: MessageSquare, title: "Comunicación Eficaz", desc: "Sin depender de WhatsApp ni correos" },
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
          LEFT PANEL - Informative content
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-[#5c85d6]/10 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-60 h-60 rounded-full bg-[#e1b82c]/10 blur-3xl" />
        <div className="absolute top-1/2 right-20 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

        {/* Brand & Title */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 mb-16">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }}>
              EduNet
            </span>
          </Link>

          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4" style={{ fontFamily: "Manrope, sans-serif" }}>
            Digitaliza la gestión de tu colegio
          </h2>
          <p className="text-blue-200/70 text-base leading-relaxed max-w-md">
            Crea tu intranet escolar y conecta a toda la comunidad educativa en un solo lugar seguro y organizado.
          </p>
        </div>

        {/* Value prop cards */}
        <div className="relative z-10 grid grid-cols-2 gap-4 my-12">
          {valueProps.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#e1b82c]/20 flex items-center justify-center mb-3 group-hover:bg-[#e1b82c]/30 transition-colors">
                  <Icon className="w-5 h-5 text-[#e1b82c]" />
                </div>
                <p className="text-sm font-bold text-white mb-1">{v.title}</p>
                <p className="text-xs text-blue-200/50 leading-relaxed">{v.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Social proof */}
        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-[#001f4b] flex items-center justify-center text-[10px] font-bold text-white">
                  {["M", "C", "A", "J"][i-1]}
                </div>
              ))}
            </div>
            <span className="text-sm font-semibold text-white ml-2">+120 colegios</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-[#e1b82c]">4.9</span>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map((i) => (
                <svg key={i} className="w-3.5 h-3.5 fill-[#e1b82c] text-[#e1b82c]" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          RIGHT PANEL - Registration form
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 flex flex-col">
        {/* Back button */}
        <div className="p-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#001f4b] transition-colors group"
            data-testid="register-back-btn"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Volver al inicio
          </Link>
        </div>

        {/* Centered form container */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md">
            {/* Mobile brand */}
            <div className="lg:hidden flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
              </div>
              <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
                EduNet
              </span>
            </div>

            {/* Card */}
            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 md:p-10">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#001f4b] to-[#1e40af] flex items-center justify-center shadow-lg shadow-blue-900/20">
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
              <p className="text-sm text-slate-500 text-center mb-8">
                Empieza gratis, sin tarjeta de crédito
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 text-sm p-3 rounded-xl text-center" data-testid="register-error">
                    {error}
                  </div>
                )}

                {/* School name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre del colegio <span className="text-red-400">*</span>
                  </label>
                  <input
                    data-testid="register-school-name"
                    type="text"
                    value={form.school_name}
                    onChange={(e) => update("school_name", e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="Ej: Colegio El Roble"
                    required
                  />
                </div>

                {/* Contact name */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nombre completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    data-testid="register-contact-name"
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => update("contact_name", e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="Tu nombre completo"
                    required
                  />
                </div>

                {/* Role select */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Cargo <span className="text-red-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setRoleOpen(!roleOpen)}
                    className="w-full flex items-center justify-between px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all"
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
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-50 transition-colors ${form.role === r ? "bg-slate-50 font-medium text-[#001f4b]" : "text-slate-700"}`}
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
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Especifica tu cargo <span className="text-red-400">*</span>
                    </label>
                    <input
                      data-testid="register-custom-role"
                      type="text"
                      value={form.custom_role}
                      onChange={(e) => update("custom_role", e.target.value)}
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                      placeholder="Ej: Secretario(a) Académico(a)"
                      required
                    />
                  </div>
                )}

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Correo electrónico <span className="text-red-400">*</span>
                  </label>
                  <input
                    data-testid="register-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                    placeholder="tu@email.com"
                    required
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    WhatsApp <span className="text-slate-400 font-normal text-xs">(opcional)</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 px-3 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 shrink-0">
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
                        className="w-full pl-10 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
                        placeholder="999 999 999"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Contraseña <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      data-testid="register-password"
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      className="w-full px-4 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] focus:bg-white transition-all placeholder:text-slate-400"
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
                  className="w-full py-4 bg-gradient-to-r from-[#001f4b] to-[#1e40af] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Crear mi cuenta"
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
            <p className="text-center text-xs text-slate-400 mt-6 px-4">
              Al crear tu cuenta aceptas los{" "}
              <span className="text-[#1e40af] cursor-pointer hover:underline">Términos de Servicio</span>{" "}
              y la{" "}
              <span className="text-[#1e40af] cursor-pointer hover:underline">Política de Privacidad</span>
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
