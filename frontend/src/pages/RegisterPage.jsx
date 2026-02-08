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
  Phone,
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
    email: "",
    password: "",
    phone: "",
  });
  const [showPass, setShowPass] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.school_name || !form.contact_name || !form.role || !form.email || !form.password) {
      setError("Por favor completa todos los campos obligatorios");
      return;
    }
    if (form.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API}/schools/register`, form);
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
      {/* ─── Left Panel ─── */}
      <div className="hidden lg:flex lg:w-[48%] bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] relative overflow-hidden flex-col justify-between p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-[#5c85d6]/10 blur-3xl" />
        <div className="absolute bottom-20 left-10 w-60 h-60 rounded-full bg-[#e1b82c]/8 blur-3xl" />
        <div className="absolute top-1/2 right-20 w-40 h-40 rounded-full bg-white/5 blur-2xl" />

        {/* Brand */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2.5 mb-20">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span
              className="text-xl font-extrabold text-white tracking-tight"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              EduNet
            </span>
          </Link>

          <h2
            className="text-4xl font-extrabold text-white leading-tight mb-4"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Digitaliza la gestión de tu colegio
          </h2>
          <p className="text-blue-200/80 text-base leading-relaxed max-w-md mb-12">
            Crea tu intranet escolar y conecta a toda la comunidad educativa en un solo lugar.
          </p>
        </div>

        {/* Value prop cards */}
        <div className="relative z-10 grid grid-cols-2 gap-4 mb-12">
          {valueProps.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-colors"
              >
                <Icon className="w-6 h-6 text-[#e1b82c] mb-3" />
                <p className="text-sm font-bold text-white mb-1">{v.title}</p>
                <p className="text-xs text-blue-200/60 leading-relaxed">{v.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Social proof */}
        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#e1b82c]" />
            <span className="text-sm font-semibold text-white">+120 colegios activos</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold text-[#e1b82c]">4.9</span>
            <span className="text-sm text-blue-200/60">valoración</span>
          </div>
        </div>
      </div>

      {/* ─── Right Panel: Form ─── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#fafbfc]">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
              EduNet
            </span>
          </div>

          <h1
            className="text-2xl font-extrabold text-[#001f4b] mb-1"
            style={{ fontFamily: "Manrope, sans-serif" }}
            data-testid="register-title"
          >
            Crea tu cuenta
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            Empieza gratis, sin tarjeta de crédito
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-xl" data-testid="register-error">
                {error}
              </div>
            )}

            {/* School name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre del colegio <span className="text-red-400">*</span>
              </label>
              <input
                data-testid="register-school-name"
                type="text"
                value={form.school_name}
                onChange={(e) => update("school_name", e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                placeholder="Ej: Colegio El Roble"
                required
              />
            </div>

            {/* Contact name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nombre completo del responsable <span className="text-red-400">*</span>
              </label>
              <input
                data-testid="register-contact-name"
                type="text"
                value={form.contact_name}
                onChange={(e) => update("contact_name", e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                placeholder="Tu nombre completo"
                required
              />
            </div>

            {/* Role select */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cargo <span className="text-red-400">*</span>
              </label>
              <button
                type="button"
                onClick={() => setRoleOpen(!roleOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                data-testid="register-role-select"
              >
                <span className={form.role ? "text-slate-800" : "text-slate-400"}>
                  {form.role || "Selecciona tu cargo"}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${roleOpen ? "rotate-180" : ""}`} />
              </button>
              {roleOpen && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {roles.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => { update("role", r); setRoleOpen(false); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#001f4b]/5 transition-colors"
                      data-testid={`role-option-${r}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Correo electrónico <span className="text-red-400">*</span>
              </label>
              <input
                data-testid="register-email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                placeholder="tu@correo.com"
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Contraseña <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  data-testid="register-password"
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  className="w-full px-4 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                  placeholder="Mínimo 6 caracteres"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  data-testid="register-toggle-password"
                >
                  {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Phone (optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Teléfono / WhatsApp <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  data-testid="register-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] transition-all"
                  placeholder="Para ayudarte con la configuración"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              data-testid="register-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#001f4b] text-white font-semibold rounded-xl hover:bg-[#001f4b]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Crear mi cuenta"
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="font-semibold text-[#001f4b] hover:underline" data-testid="register-login-link">
              Inicia sesión
            </Link>
          </p>

          <p className="text-center text-[11px] text-slate-400 mt-4">
            Al crear tu cuenta aceptas los{" "}
            <span className="text-[#5c85d6] cursor-pointer hover:underline">Términos de Servicio</span>{" "}
            y la{" "}
            <span className="text-[#5c85d6] cursor-pointer hover:underline">Política de Privacidad</span>
          </p>
        </div>
      </div>
    </div>
  );
}
