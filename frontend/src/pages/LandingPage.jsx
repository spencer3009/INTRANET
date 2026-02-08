import { useState } from "react";
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
  Lock,
  Zap,
  Globe,
  Phone,
  Mail,
  Clock,
  Award,
  TrendingUp,
  ChevronDown,
  Play,
} from "lucide-react";

/* ─── Data ─── */

const stats = [
  { value: "120+", label: "Colegios activos" },
  { value: "45,000+", label: "Usuarios conectados" },
  { value: "99.9%", label: "Uptime garantizado" },
  { value: "4.9/5", label: "Satisfacción" },
];

const features = [
  {
    icon: Users,
    title: "Gestión de Comunidad",
    desc: "Conecta a padres, docentes y directivos en un solo lugar seguro y organizado.",
    highlight: "Comunicación centralizada",
  },
  {
    icon: BarChart3,
    title: "Reportes en Tiempo Real",
    desc: "Métricas de asistencia, calificaciones y desempeño académico al instante.",
    highlight: "Datos inteligentes",
  },
  {
    icon: Calendar,
    title: "Calendario Integrado",
    desc: "Eventos, reuniones y actividades académicas sincronizadas para toda la comunidad.",
    highlight: "Todo sincronizado",
  },
  {
    icon: MessageSquare,
    title: "Comunicación Directa",
    desc: "Mensajería institucional y comunicados sin depender de WhatsApp ni correos personales.",
    highlight: "Sin WhatsApp",
  },
  {
    icon: BookOpen,
    title: "Recursos Académicos",
    desc: "Biblioteca digital, tareas y materiales centralizados accesibles desde cualquier dispositivo.",
    highlight: "Acceso 24/7",
  },
  {
    icon: Shield,
    title: "Seguridad de Nivel Empresarial",
    desc: "Encriptación de datos, control de acceso por roles y cumplimiento de normas de privacidad.",
    highlight: "Datos protegidos",
  },
];

const steps = [
  { num: "01", title: "Crea tu cuenta", desc: "Regístrate en menos de 60 segundos con los datos básicos de tu colegio.", icon: Zap },
  { num: "02", title: "Configura tu intranet", desc: "Elige tu subdominio personalizado y personaliza la plataforma a tu medida.", icon: Globe },
  { num: "03", title: "Invita a tu comunidad", desc: "Agrega docentes, personal y padres de familia con invitaciones simples.", icon: Users },
  { num: "04", title: "¡Listo para gestionar!", desc: "Empieza a usar todas las herramientas desde el primer día.", icon: Award },
];

const testimonials = [
  {
    name: "María Torres Gutiérrez",
    role: "Directora General",
    school: "Colegio San Martín de Porres, Lima",
    text: "EduNet transformó completamente la comunicación en nuestro colegio. Los padres ahora están informados en tiempo real y las reuniones se organizan sin caos. En 3 meses redujimos las quejas por falta de información en un 80%.",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=100",
  },
  {
    name: "Carlos Mendoza Rivera",
    role: "Administrador",
    school: "I.E. Los Andes, Arequipa",
    text: "La plataforma es increíblemente intuitiva. En una semana ya teníamos todo funcionando sin necesidad de capacitación técnica. El soporte de EduNet es excepcional, siempre responden en menos de una hora.",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100",
  },
  {
    name: "Ana Flores Castillo",
    role: "Coordinadora Académica",
    school: "Colegio Santa Rosa, Trujillo",
    text: "Los reportes automáticos nos ahorran más de 15 horas semanales de trabajo administrativo. Las calificaciones, asistencias y comunicados ahora están centralizados y accesibles desde el celular.",
    stars: 5,
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100",
  },
];

const plans = [
  {
    name: "Básico",
    price: "Gratis",
    period: "Para empezar",
    desc: "Ideal para colegios pequeños que quieren digitalizar su gestión.",
    features: ["Hasta 200 alumnos", "Comunicados y eventos", "Calendario escolar", "1 administrador", "Soporte por email"],
    cta: "Empezar gratis",
    popular: false,
  },
  {
    name: "Profesional",
    price: "S/. 149",
    period: "/mes",
    desc: "Para colegios que necesitan herramientas completas de gestión.",
    features: ["Alumnos ilimitados", "Reportes avanzados", "Calificaciones y asistencia", "Roles personalizados", "Soporte prioritario", "Subdominio personalizado", "Integración WhatsApp"],
    cta: "Iniciar prueba gratuita",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Consultar",
    period: "",
    desc: "Para redes de colegios y grandes instituciones educativas.",
    features: ["Multi-sede", "API personalizada", "Onboarding dedicado", "SLA garantizado", "Capacitación presencial", "Personalización completa", "Manager de cuenta"],
    cta: "Contactar ventas",
    popular: false,
  },
];

const faqs = [
  { q: "¿Cuánto tiempo toma implementar EduNet en mi colegio?", a: "La configuración inicial toma menos de 5 minutos. El onboarding completo con datos de alumnos y docentes se puede completar en 1-2 días hábiles con nuestro soporte." },
  { q: "¿Mis datos están seguros?", a: "Absolutamente. Usamos encriptación AES-256, servidores en la nube con certificación SOC 2, y cumplimos con las normativas de protección de datos de Perú. Tus datos nunca se comparten con terceros." },
  { q: "¿Los padres necesitan descargar alguna app?", a: "No. EduNet funciona 100% desde el navegador web, tanto en computadoras como en celulares. No requiere descarga ni instalación." },
  { q: "¿Puedo migrar desde mi sistema actual?", a: "Sí. Nuestro equipo te ayuda con la migración de datos sin costo adicional en el plan Profesional. Soportamos importación desde Excel y otros sistemas." },
  { q: "¿Qué pasa si cancelo mi suscripción?", a: "Puedes exportar todos tus datos en cualquier momento. No hay penalidades ni contratos de permanencia. Tu información siempre te pertenece." },
];

const schoolLogos = [
  "Colegio San Martín", "I.E. Los Andes", "Santa Rosa", "El Roble",
  "San Ignacio", "María Reina", "La Salle", "San Agustín",
];

/* ─── Component ─── */

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen bg-white overflow-hidden" data-testid="landing-page">

      {/* ═══ Navbar ═══ */}
      <nav className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-xl border-b border-slate-100/80">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center shadow-lg shadow-[#001f4b]/20">
              <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
            </div>
            <span className="text-xl font-extrabold text-[#001f4b] tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="landing-brand">
              EduNet
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-8 text-[13px] font-semibold text-slate-500 uppercase tracking-wider">
            <a href="#features" className="hover:text-[#001f4b] transition-colors">Funcionalidades</a>
            <a href="#how-it-works" className="hover:text-[#001f4b] transition-colors">Cómo funciona</a>
            <a href="#testimonials" className="hover:text-[#001f4b] transition-colors">Testimonios</a>
            <a href="#pricing" className="hover:text-[#001f4b] transition-colors">Planes</a>
            <a href="#faq" className="hover:text-[#001f4b] transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-[#001f4b] hover:text-[#001f4b]/70 transition-colors px-4 py-2.5 rounded-xl hover:bg-slate-50" data-testid="landing-login-btn">
              Ingresar
            </Link>
            <Link to="/register" className="text-sm font-semibold bg-[#001f4b] text-white px-6 py-2.5 rounded-xl hover:bg-[#001f4b]/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-[#001f4b]/20" data-testid="landing-register-btn">
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="pt-32 pb-8 px-6 relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-[10%] w-[500px] h-[500px] rounded-full bg-[#001f4b]/[0.03] blur-[80px]" />
          <div className="absolute top-60 left-[5%] w-[300px] h-[300px] rounded-full bg-[#e1b82c]/[0.06] blur-[60px]" />
          <div className="absolute bottom-0 right-[30%] w-[400px] h-[400px] rounded-full bg-[#5c85d6]/[0.04] blur-[70px]" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2.5 bg-[#001f4b]/5 border border-[#001f4b]/10 px-5 py-2 rounded-full">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-[#001f4b] uppercase tracking-wider">
                Plataforma #1 de intranets escolares en Perú
              </span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-[#001f4b] leading-[1.05] mb-6" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="landing-hero-title">
              La plataforma que{" "}
              <span className="relative inline-block">
                <span className="relative z-10">transforma</span>
                <span className="absolute bottom-2 left-0 w-full h-3 bg-[#e1b82c]/30 -z-0 rounded" />
              </span>{" "}
              la gestión escolar
            </h1>

            <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-2xl mx-auto mb-10">
              Conecta a toda tu comunidad educativa en un solo lugar. Comunicaciones, calificaciones, asistencia y más — todo en una intranet segura y fácil de usar.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
              <Link to="/register" className="group inline-flex items-center justify-center gap-3 bg-[#001f4b] text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all hover:-translate-y-1 shadow-xl shadow-[#001f4b]/25 hover:shadow-2xl hover:shadow-[#001f4b]/30" data-testid="hero-register-btn">
                Crear mi cuenta gratis
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/login" className="group inline-flex items-center justify-center gap-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold px-8 py-4 rounded-2xl text-base transition-all hover:border-[#001f4b] hover:text-[#001f4b] hover:shadow-lg" data-testid="hero-login-btn">
                Ingresar a mi Intranet
                <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Sin tarjeta de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Setup en 5 minutos</span>
              <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-emerald-500" /> Soporte en español</span>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="mt-16 max-w-5xl mx-auto">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-b from-[#001f4b]/5 to-transparent rounded-[32px] blur-xl" />
              <div className="relative bg-white rounded-2xl border border-slate-200/80 shadow-2xl shadow-slate-300/30 overflow-hidden">
                {/* Browser bar */}
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                  <div className="flex-1 bg-white rounded-lg px-4 py-1.5 text-xs text-slate-400 border border-slate-200 flex items-center gap-2">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    micolegio.edunet.pe/dashboard
                  </div>
                </div>
                {/* Dashboard content */}
                <div className="p-6 grid grid-cols-12 gap-4">
                  {/* Sidebar mini */}
                  <div className="col-span-1 bg-[#001f4b] rounded-xl p-2 flex flex-col items-center gap-3 py-4">
                    <div className="w-6 h-6 rounded-lg bg-[#e1b82c]/20 flex items-center justify-center"><GraduationCap className="w-3 h-3 text-[#e1b82c]" /></div>
                    {[1,2,3,4,5].map(i => <div key={i} className="w-5 h-5 rounded-lg bg-white/10" />)}
                  </div>
                  {/* Main */}
                  <div className="col-span-8 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="bg-[#001f4b] rounded-xl p-4 text-white"><p className="text-xl font-extrabold" style={{fontFamily:"Manrope"}}>456</p><p className="text-[10px] text-white/60">Alumnos</p></div>
                      <div className="bg-[#5c85d6] rounded-xl p-4 text-white"><p className="text-xl font-extrabold" style={{fontFamily:"Manrope"}}>98%</p><p className="text-[10px] text-white/60">Asistencia</p></div>
                      <div className="bg-emerald-500 rounded-xl p-4 text-white"><p className="text-xl font-extrabold" style={{fontFamily:"Manrope"}}>15.2</p><p className="text-[10px] text-white/60">Promedio</p></div>
                      <div className="bg-[#e1b82c] rounded-xl p-4 text-[#001f4b]"><p className="text-xl font-extrabold" style={{fontFamily:"Manrope"}}>24</p><p className="text-[10px] text-[#001f4b]/60">Docentes</p></div>
                    </div>
                    <div className="bg-slate-50 rounded-xl h-28 flex items-center px-6">
                      <div className="flex gap-3 items-end">
                        {[40,55,45,65,50,70,60,75,65,80,70,85].map((h,i) => (
                          <div key={i} className="w-4 bg-[#001f4b] rounded-t" style={{height: `${h}%`}} />
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Right panel */}
                  <div className="col-span-3 space-y-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#e1b82c]/20 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">Ana García</p>
                      <p className="text-[10px] text-slate-400">Directora</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                      <p className="text-[10px] font-bold text-slate-500">EVENTOS</p>
                      {[1,2,3].map(i => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-[#001f4b]" />
                          <div className="h-2 bg-slate-200 rounded flex-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Social Proof Bar ═══ */}
      <section className="py-12 px-6 border-y border-slate-100 bg-slate-50/50 mt-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
            Colegios que confían en EduNet
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {schoolLogos.map((name) => (
              <div key={name} className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity">
                <div className="w-6 h-6 rounded bg-slate-300" />
                <span className="text-sm font-semibold text-slate-600">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Stats ═══ */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-4xl md:text-5xl font-extrabold text-[#001f4b] mb-2" style={{ fontFamily: "Manrope" }}>
                {s.value}
              </p>
              <p className="text-sm text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" className="py-24 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">
              Funcionalidades
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#001f4b] mb-5" style={{ fontFamily: "Manrope" }}>
              Todo lo que tu colegio necesita
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">
              Una plataforma completa para digitalizar la gestión escolar y mejorar la comunicación con toda la comunidad educativa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-xl hover:border-[#001f4b]/10 hover:-translate-y-2 transition-all duration-300" data-testid={`feature-card`}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-[#001f4b]/5 group-hover:bg-[#001f4b] flex items-center justify-center transition-colors duration-300">
                      <Icon className="w-6 h-6 text-[#001f4b] group-hover:text-[#e1b82c] transition-colors duration-300" />
                    </div>
                    <span className="text-[10px] font-bold text-[#e1b82c] uppercase tracking-widest">{f.highlight}</span>
                  </div>
                  <h3 className="text-lg font-bold text-[#001f4b] mb-3" style={{ fontFamily: "Manrope" }}>{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">
              Cómo funciona
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#001f4b] mb-5" style={{ fontFamily: "Manrope" }}>
              Tu intranet lista en 4 pasos
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Sin complicaciones técnicas. Sin necesidad de un equipo de IT.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="relative">
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-12 left-[60%] w-[calc(100%-20%)] h-[2px] bg-gradient-to-r from-[#001f4b]/20 to-transparent" />
                  )}
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-[#001f4b] flex items-center justify-center mb-5 shadow-lg shadow-[#001f4b]/20">
                      <Icon className="w-6 h-6 text-[#e1b82c]" />
                    </div>
                    <span className="text-xs font-extrabold text-[#e1b82c] tracking-widest">{s.num}</span>
                    <h3 className="text-lg font-bold text-[#001f4b] mt-1 mb-2" style={{ fontFamily: "Manrope" }}>{s.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Testimonials ═══ */}
      <section id="testimonials" className="py-24 px-6 bg-[#001f4b]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">
              Testimonios
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ fontFamily: "Manrope" }}>
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-lg text-blue-200/70 max-w-xl mx-auto">
              Colegios reales que ya transformaron su gestión con EduNet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors">
                <div className="flex gap-0.5 mb-5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#e1b82c] text-[#e1b82c]" />
                  ))}
                </div>
                <p className="text-sm text-blue-100/80 leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                  <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover border-2 border-[#e1b82c]/30" onError={(e) => { e.target.src = 'https://via.placeholder.com/44'; }} />
                  <div>
                    <p className="text-sm font-bold text-white">{t.name}</p>
                    <p className="text-[11px] text-blue-200/50">{t.role} — {t.school}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Pricing ═══ */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">
              Planes
            </span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#001f4b] mb-5" style={{ fontFamily: "Manrope" }}>
              Un plan para cada colegio
            </h2>
            <p className="text-lg text-slate-500 max-w-xl mx-auto">
              Sin contratos de permanencia. Cancela cuando quieras.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p) => (
              <div key={p.name} className={`relative rounded-2xl p-8 border transition-all hover:-translate-y-1 hover:shadow-xl ${p.popular ? "bg-[#001f4b] text-white border-[#001f4b] shadow-xl shadow-[#001f4b]/20 scale-[1.02]" : "bg-white border-slate-200 shadow-sm"}`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#e1b82c] text-[#001f4b] text-[10px] font-extrabold uppercase tracking-widest px-4 py-1 rounded-full">
                    Más popular
                  </div>
                )}
                <h3 className={`text-lg font-bold mb-1 ${p.popular ? "text-white" : "text-[#001f4b]"}`} style={{ fontFamily: "Manrope" }}>{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-extrabold ${p.popular ? "text-white" : "text-[#001f4b]"}`} style={{ fontFamily: "Manrope" }}>{p.price}</span>
                  {p.period && <span className={`text-sm ${p.popular ? "text-blue-200/60" : "text-slate-400"}`}>{p.period}</span>}
                </div>
                <p className={`text-sm mb-6 ${p.popular ? "text-blue-200/70" : "text-slate-500"}`}>{p.desc}</p>
                <ul className="space-y-3 mb-8">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5">
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${p.popular ? "text-[#e1b82c]" : "text-emerald-500"}`} />
                      <span className={`text-sm ${p.popular ? "text-blue-100/80" : "text-slate-600"}`}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register" className={`block text-center font-semibold py-3 rounded-xl transition-all ${p.popular ? "bg-[#e1b82c] text-[#001f4b] hover:bg-[#e1b82c]/90" : "bg-[#001f4b]/5 text-[#001f4b] hover:bg-[#001f4b] hover:text-white"}`}>
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Security & Trust ═══ */}
      <section className="py-16 px-6 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-[#001f4b]/5 flex items-center justify-center mb-3"><Lock className="w-5 h-5 text-[#001f4b]" /></div>
              <p className="text-xs font-bold text-[#001f4b]">Encriptación AES-256</p>
              <p className="text-[11px] text-slate-400 mt-1">Datos siempre protegidos</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-[#001f4b]/5 flex items-center justify-center mb-3"><Shield className="w-5 h-5 text-[#001f4b]" /></div>
              <p className="text-xs font-bold text-[#001f4b]">Cumplimiento LGPDP</p>
              <p className="text-[11px] text-slate-400 mt-1">Normativa peruana</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-[#001f4b]/5 flex items-center justify-center mb-3"><Clock className="w-5 h-5 text-[#001f4b]" /></div>
              <p className="text-xs font-bold text-[#001f4b]">99.9% Uptime</p>
              <p className="text-[11px] text-slate-400 mt-1">Disponibilidad garantizada</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-[#001f4b]/5 flex items-center justify-center mb-3"><Phone className="w-5 h-5 text-[#001f4b]" /></div>
              <p className="text-xs font-bold text-[#001f4b]">Soporte en español</p>
              <p className="text-[11px] text-slate-400 mt-1">Respuesta en menos de 1h</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">
              Preguntas frecuentes
            </span>
            <h2 className="text-4xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
              ¿Tienes dudas?
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left" data-testid={`faq-${i}`}>
                  <span className="text-sm font-semibold text-[#001f4b] pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 -mt-2">
                    <p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section className="py-24 px-6 bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#e1b82c]/5 blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#5c85d6]/10 blur-[80px]" />

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ fontFamily: "Manrope" }}>
            El futuro de tu colegio empieza hoy
          </h2>
          <p className="text-lg text-blue-200/70 mb-10 max-w-xl mx-auto">
            Únete a más de 120 colegios que ya transformaron su gestión con EduNet. Empieza gratis, sin compromiso.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="group inline-flex items-center justify-center gap-2 bg-[#e1b82c] text-[#001f4b] font-bold px-10 py-4 rounded-2xl text-base transition-all hover:-translate-y-1 shadow-xl shadow-[#e1b82c]/20 hover:shadow-2xl" data-testid="cta-register-btn">
              Crear mi cuenta gratis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-white font-semibold px-10 py-4 rounded-2xl text-base hover:bg-white/10 transition-all" data-testid="cta-login-btn">
              Ingresar a mi Intranet
            </Link>
          </div>
          <p className="text-xs text-blue-200/40 mt-8">Sin tarjeta de crédito · Sin contratos · Cancela cuando quieras</p>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-12 px-6 border-t border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#001f4b] flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-[#e1b82c]" />
                </div>
                <span className="text-base font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>EduNet</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">La plataforma de intranet escolar más confiable de Perú.</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#001f4b] uppercase tracking-wider mb-3">Producto</p>
              <div className="space-y-2 text-xs text-slate-500">
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Funcionalidades</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Planes y precios</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Seguridad</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Actualizaciones</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#001f4b] uppercase tracking-wider mb-3">Soporte</p>
              <div className="space-y-2 text-xs text-slate-500">
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Centro de ayuda</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Contacto</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Comunidad</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Estado del servicio</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#001f4b] uppercase tracking-wider mb-3">Legal</p>
              <div className="space-y-2 text-xs text-slate-500">
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Términos de servicio</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Política de privacidad</p>
                <p className="hover:text-[#001f4b] cursor-pointer transition-colors">Protección de datos</p>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-slate-400">EduNet &copy; 2026 — Todos los derechos reservados. Lima, Perú.</p>
            <div className="flex items-center gap-4">
              <Mail className="w-4 h-4 text-slate-300 hover:text-[#001f4b] cursor-pointer transition-colors" />
              <Phone className="w-4 h-4 text-slate-300 hover:text-[#001f4b] cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
