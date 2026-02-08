import { Link } from "react-router-dom";
import {
  Shield,
  Users,
  BarChart3,
  Calendar,
  MessageSquare,
  BookOpen,
  ChevronRight,
  CheckCircle,
  Star,
  ArrowRight,
  GraduationCap,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestión de Comunidad",
    desc: "Conecta a padres, docentes y directivos en un solo lugar seguro.",
  },
  {
    icon: BarChart3,
    title: "Reportes en Tiempo Real",
    desc: "Métricas de asistencia, calificaciones y desempeño al instante.",
  },
  {
    icon: Calendar,
    title: "Calendario Integrado",
    desc: "Eventos, reuniones y actividades académicas sincronizadas.",
  },
  {
    icon: MessageSquare,
    title: "Comunicación Directa",
    desc: "Mensajería y comunicados sin depender de WhatsApp.",
  },
  {
    icon: BookOpen,
    title: "Recursos Académicos",
    desc: "Biblioteca digital, tareas y materiales centralizados.",
  },
  {
    icon: Shield,
    title: "Seguridad Total",
    desc: "Datos protegidos con encriptación y acceso por roles.",
  },
];

const testimonials = [
  {
    name: "María Torres",
    role: "Directora, Colegio San Martín",
    text: "EduNet transformó la comunicación con los padres. Ahora todo es más rápido y organizado.",
    stars: 5,
  },
  {
    name: "Carlos Mendoza",
    role: "Administrador, I.E. Los Andes",
    text: "La plataforma es muy intuitiva. En una semana ya teníamos todo funcionando.",
    stars: 5,
  },
  {
    name: "Ana Flores",
    role: "Coordinadora, Colegio Santa Rosa",
    text: "Los reportes automáticos nos ahorran horas de trabajo cada semana.",
    stars: 5,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" data-testid="landing-page">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-lg border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span
              className="text-xl font-extrabold text-[#001f4b] tracking-tight"
              style={{ fontFamily: "Manrope, sans-serif" }}
              data-testid="landing-brand"
            >
              EduNet
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-[#001f4b] transition-colors">Funcionalidades</a>
            <a href="#testimonials" className="hover:text-[#001f4b] transition-colors">Testimonios</a>
            <a href="#pricing" className="hover:text-[#001f4b] transition-colors">Planes</a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-semibold text-[#001f4b] hover:text-[#001f4b]/70 transition-colors px-4 py-2"
              data-testid="landing-login-btn"
            >
              Ingresar
            </Link>
            <Link
              to="/register"
              className="text-sm font-semibold bg-[#001f4b] text-white px-5 py-2.5 rounded-xl hover:bg-[#001f4b]/90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              data-testid="landing-register-btn"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-36 pb-20 px-6 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute top-20 right-0 w-[600px] h-[600px] rounded-full bg-[#001f4b]/[0.03] blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-[#e1b82c]/[0.05] blur-3xl" />

        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16 relative z-10">
          <div className="flex-1 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-[#e1b82c]/10 border border-[#e1b82c]/20 px-4 py-1.5 rounded-full mb-6">
              <span className="w-2 h-2 bg-[#e1b82c] rounded-full animate-pulse" />
              <span className="text-xs font-bold text-[#001f4b] uppercase tracking-wider">
                Nuevo en Perú
              </span>
            </div>

            <h1
              className="text-5xl lg:text-6xl font-extrabold text-[#001f4b] leading-[1.1] mb-6"
              style={{ fontFamily: "Manrope, sans-serif" }}
              data-testid="landing-hero-title"
            >
              La intranet que tu colegio necesita
            </h1>

            <p className="text-lg text-slate-600 leading-relaxed mb-8 max-w-lg">
              Gestiona comunicaciones, calificaciones, asistencia y más en una
              plataforma segura diseñada para colegios en Perú.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-[#001f4b] text-white font-semibold px-8 py-4 rounded-2xl text-base hover:bg-[#001f4b]/90 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#001f4b]/20"
                data-testid="hero-register-btn"
              >
                Crear mi cuenta gratis
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-700 font-semibold px-8 py-4 rounded-2xl text-base hover:border-[#001f4b] hover:text-[#001f4b] transition-all"
                data-testid="hero-login-btn"
              >
                Ingresar a mi Intranet
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="flex items-center gap-6 mt-10 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Sin tarjeta de crédito
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-500" /> Configuración en 5 min
              </span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="flex-1 max-w-lg w-full">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#001f4b]/10 to-[#e1b82c]/10 rounded-3xl blur-2xl scale-105" />
              <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl shadow-slate-200/50 p-6 space-y-4">
                {/* Mini dashboard preview */}
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-[#001f4b] flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-[#e1b82c]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#001f4b]">Mi Colegio</p>
                    <p className="text-[10px] text-slate-400">micolegio.edunet.pe</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#001f4b] text-white p-4 rounded-2xl">
                    <p className="text-2xl font-extrabold" style={{ fontFamily: "Manrope" }}>456</p>
                    <p className="text-[11px] text-white/70">Alumnos</p>
                  </div>
                  <div className="bg-[#e1b82c] text-[#001f4b] p-4 rounded-2xl">
                    <p className="text-2xl font-extrabold" style={{ fontFamily: "Manrope" }}>98%</p>
                    <p className="text-[11px] text-[#001f4b]/70">Asistencia</p>
                  </div>
                  <div className="bg-emerald-500 text-white p-4 rounded-2xl">
                    <p className="text-2xl font-extrabold" style={{ fontFamily: "Manrope" }}>15.2</p>
                    <p className="text-[11px] text-white/70">Promedio</p>
                  </div>
                  <div className="bg-[#5c85d6] text-white p-4 rounded-2xl">
                    <p className="text-2xl font-extrabold" style={{ fontFamily: "Manrope" }}>24</p>
                    <p className="text-[11px] text-white/70">Docentes</p>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-4">
                  <p className="text-xs font-bold text-slate-700 mb-2">Próximo evento</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#001f4b] flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Reunión de Padres</p>
                      <p className="text-[11px] text-slate-400">Lunes 18 Feb, 9:00 AM</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[#e1b82c] uppercase tracking-wider mb-3">Funcionalidades</p>
            <h2
              className="text-4xl font-extrabold text-[#001f4b] mb-4"
              style={{ fontFamily: "Manrope, sans-serif" }}
            >
              Todo lo que tu colegio necesita
            </h2>
            <p className="text-slate-600 max-w-lg mx-auto">
              Una plataforma completa para digitalizar la gestión escolar y mejorar la
              comunicación con toda la comunidad educativa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
                  data-testid={`feature-${f.title.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[#001f4b]/5 group-hover:bg-[#001f4b] flex items-center justify-center mb-5 transition-colors duration-300">
                    <Icon className="w-6 h-6 text-[#001f4b] group-hover:text-[#e1b82c] transition-colors duration-300" />
                  </div>
                  <h3 className="text-lg font-bold text-[#001f4b] mb-2" style={{ fontFamily: "Manrope" }}>
                    {f.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-[#e1b82c] uppercase tracking-wider mb-3">Testimonios</p>
            <h2 className="text-4xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
              Colegios que ya confían en EduNet
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#e1b82c] text-[#e1b82c]" />
                  ))}
                </div>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">"{t.text}"</p>
                <div>
                  <p className="text-sm font-bold text-[#001f4b]">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section id="pricing" className="py-24 px-6 bg-[#001f4b]">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-4xl font-extrabold text-white mb-4"
            style={{ fontFamily: "Manrope" }}
          >
            Empieza hoy, gratis
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            Crea tu intranet escolar en menos de 5 minutos. Sin compromiso, sin tarjeta de crédito.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 bg-[#e1b82c] text-[#001f4b] font-bold px-8 py-4 rounded-2xl text-base hover:bg-[#e1b82c]/90 transition-all hover:-translate-y-1 hover:shadow-xl"
              data-testid="cta-register-btn"
            >
              Crear mi cuenta gratis
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-white font-semibold px-8 py-4 rounded-2xl text-base hover:bg-white/10 transition-all"
              data-testid="cta-login-btn"
            >
              Ingresar a mi Intranet
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="py-8 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#001f4b] flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-[#e1b82c]" />
            </div>
            <span className="text-sm font-bold text-[#001f4b]">EduNet</span>
          </div>
          <p className="text-xs text-slate-400">EduNet &copy; 2026 — Intranet para colegios en Perú</p>
        </div>
      </footer>
    </div>
  );
}
