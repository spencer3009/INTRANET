import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Users, BarChart3, Calendar, MessageSquare, BookOpen,
  ChevronRight, CheckCircle, Star, ArrowRight, GraduationCap,
  Lock, Zap, Globe, Phone, Mail, Clock, Award, TrendingUp,
  ChevronDown, Play,
} from "lucide-react";

const stats = [
  { value: "120+", label: "Colegios activos", icon: GraduationCap },
  { value: "45,000+", label: "Usuarios conectados", icon: Users },
  { value: "99.9%", label: "Uptime garantizado", icon: TrendingUp },
  { value: "4.9/5", label: "Satisfacción", icon: Star },
];

const features = [
  { icon: Users, title: "Gestión de Comunidad", desc: "Conecta a padres, docentes y directivos en un solo lugar seguro y organizado.", img: "https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&q=80&w=400" },
  { icon: BarChart3, title: "Reportes en Tiempo Real", desc: "Métricas de asistencia, calificaciones y desempeño académico al instante.", img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=400" },
  { icon: Calendar, title: "Calendario Integrado", desc: "Eventos, reuniones y actividades académicas sincronizadas.", img: "https://images.unsplash.com/photo-1506784983877-45594efa4cbe?auto=format&fit=crop&q=80&w=400" },
  { icon: MessageSquare, title: "Comunicación Directa", desc: "Mensajería institucional sin depender de WhatsApp.", img: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&q=80&w=400" },
  { icon: BookOpen, title: "Recursos Académicos", desc: "Biblioteca digital, tareas y materiales centralizados.", img: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80&w=400" },
  { icon: Shield, title: "Seguridad Total", desc: "Encriptación de datos y control de acceso por roles.", img: "https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=400" },
];

const steps = [
  { num: "01", title: "Crea tu cuenta", desc: "Regístrate en menos de 60 segundos con los datos básicos de tu colegio.", icon: Zap },
  { num: "02", title: "Configura tu intranet", desc: "Elige tu subdominio personalizado y personaliza la plataforma.", icon: Globe },
  { num: "03", title: "Invita a tu comunidad", desc: "Agrega docentes, personal y padres con invitaciones simples.", icon: Users },
  { num: "04", title: "¡Listo para gestionar!", desc: "Empieza a usar todas las herramientas desde el primer día.", icon: Award },
];

const testimonials = [
  { name: "María Torres Gutiérrez", role: "Directora General", school: "Colegio San Martín de Porres, Lima", text: "EduNet transformó completamente la comunicación en nuestro colegio. Los padres ahora están informados en tiempo real. En 3 meses redujimos las quejas por falta de información en un 80%.", stars: 5, avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&q=80&w=100" },
  { name: "Carlos Mendoza Rivera", role: "Administrador", school: "I.E. Los Andes, Arequipa", text: "La plataforma es increíblemente intuitiva. En una semana ya teníamos todo funcionando sin capacitación técnica. El soporte es excepcional.", stars: 5, avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=100" },
  { name: "Ana Flores Castillo", role: "Coordinadora Académica", school: "Colegio Santa Rosa, Trujillo", text: "Los reportes automáticos nos ahorran más de 15 horas semanales. Calificaciones, asistencias y comunicados ahora centralizados y accesibles desde el celular.", stars: 5, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=100" },
];

const plans = [
  { name: "Básico", price: "Gratis", period: "Para empezar", desc: "Ideal para colegios pequeños.", features: ["Hasta 200 alumnos", "Comunicados y eventos", "Calendario escolar", "1 administrador", "Soporte por email"], cta: "Empezar gratis", popular: false },
  { name: "Profesional", price: "S/. 149", period: "/mes", desc: "Herramientas completas de gestión.", features: ["Alumnos ilimitados", "Reportes avanzados", "Calificaciones y asistencia", "Roles personalizados", "Soporte prioritario", "Subdominio personalizado", "Integración WhatsApp"], cta: "Iniciar prueba gratuita", popular: true },
  { name: "Enterprise", price: "Consultar", period: "", desc: "Para redes de colegios.", features: ["Multi-sede", "API personalizada", "Onboarding dedicado", "SLA garantizado", "Capacitación presencial", "Personalización completa", "Manager de cuenta"], cta: "Contactar ventas", popular: false },
];

const faqs = [
  { q: "¿Cuánto tiempo toma implementar EduNet?", a: "La configuración inicial toma menos de 5 minutos. El onboarding completo se puede completar en 1-2 días hábiles con nuestro soporte." },
  { q: "¿Mis datos están seguros?", a: "Usamos encriptación AES-256, servidores con certificación SOC 2, y cumplimos con las normativas de protección de datos de Perú." },
  { q: "¿Los padres necesitan descargar alguna app?", a: "No. EduNet funciona 100% desde el navegador web, en computadoras y celulares. No requiere descarga." },
  { q: "¿Puedo migrar desde mi sistema actual?", a: "Sí. Nuestro equipo te ayuda con la migración de datos sin costo adicional en el plan Profesional." },
  { q: "¿Qué pasa si cancelo mi suscripción?", a: "Puedes exportar todos tus datos en cualquier momento. No hay penalidades ni contratos de permanencia." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="min-h-screen overflow-hidden" data-testid="landing-page">

      {/* ═══ Navbar ═══ */}
      <nav className="fixed top-0 w-full z-50 bg-[#001f4b]/95 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e1b82c] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-[#001f4b]" />
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="landing-brand">EduNet</span>
          </Link>
          <div className="hidden lg:flex items-center gap-8 text-[13px] font-medium text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Testimonios</a>
            <a href="#pricing" className="hover:text-white transition-colors">Planes</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-white/80 hover:text-white transition-colors px-4 py-2.5" data-testid="landing-login-btn">Ingresar</Link>
            <Link to="/register" className="text-sm font-semibold bg-[#e1b82c] text-[#001f4b] px-6 py-2.5 rounded-xl hover:bg-[#e1b82c]/90 transition-all hover:-translate-y-0.5 shadow-lg shadow-[#e1b82c]/20" data-testid="landing-register-btn">Crear cuenta gratis</Link>
          </div>
        </div>
      </nav>

      {/* ═══ Hero — Full navy with image ═══ */}
      <section className="relative bg-[#001f4b] pt-[72px] overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=1920" alt="" className="w-full h-full object-cover opacity-15" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#001f4b] via-[#001f4b]/90 to-[#001f4b]" />
        </div>

        <div className="absolute top-40 right-[5%] w-[400px] h-[400px] rounded-full bg-[#e1b82c]/10 blur-[100px]" />
        <div className="absolute bottom-20 left-[10%] w-[300px] h-[300px] rounded-full bg-[#5c85d6]/15 blur-[80px]" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left text */}
            <div className="flex-1 max-w-2xl">
              <div className="inline-flex items-center gap-2.5 bg-white/10 border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 bg-[#e1b82c] rounded-full animate-pulse" />
                <span className="text-xs font-bold text-[#e1b82c] uppercase tracking-wider">Plataforma #1 en Perú</span>
              </div>

              <h1 className="text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] mb-6" style={{ fontFamily: "Manrope, sans-serif" }} data-testid="landing-hero-title">
                La plataforma que{" "}
                <span className="text-[#e1b82c]">transforma</span>{" "}
                la gestión escolar
              </h1>

              <p className="text-lg text-blue-100/70 leading-relaxed mb-10 max-w-lg">
                Conecta a toda tu comunidad educativa en un solo lugar. Comunicaciones, calificaciones, asistencia y más — todo seguro y fácil de usar.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/register" className="group inline-flex items-center justify-center gap-3 bg-[#e1b82c] text-[#001f4b] font-bold px-8 py-4 rounded-2xl text-base transition-all hover:-translate-y-1 shadow-xl shadow-[#e1b82c]/20" data-testid="hero-register-btn">
                  Crear mi cuenta gratis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link to="/login" className="group inline-flex items-center justify-center gap-3 bg-white/10 border border-white/20 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all hover:bg-white/20 backdrop-blur-sm" data-testid="hero-login-btn">
                  Ingresar a mi Intranet
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>

              <div className="flex items-center gap-5 text-sm text-blue-200/50">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#e1b82c]" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#e1b82c]" /> 5 min setup</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-[#e1b82c]" /> Soporte español</span>
              </div>
            </div>

            {/* Right — Hero Image + Floating Cards */}
            <div className="flex-1 max-w-xl w-full relative">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/30 border border-white/10">
                <img src="https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=600&h=450" alt="Estudiantes en clase" className="w-full h-[400px] object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001f4b]/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6">
                  <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-4 shadow-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-[#001f4b] flex items-center justify-center">
                        <GraduationCap className="w-4 h-4 text-[#e1b82c]" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#001f4b]">Dashboard EduNet</p>
                        <p className="text-[10px] text-slate-400">micolegio.edunet.pe</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-[#001f4b] rounded-xl p-2.5 text-center"><p className="text-lg font-extrabold text-white" style={{ fontFamily: "Manrope" }}>456</p><p className="text-[9px] text-white/60">Alumnos</p></div>
                      <div className="bg-[#5c85d6] rounded-xl p-2.5 text-center"><p className="text-lg font-extrabold text-white" style={{ fontFamily: "Manrope" }}>98%</p><p className="text-[9px] text-white/60">Asistencia</p></div>
                      <div className="bg-emerald-500 rounded-xl p-2.5 text-center"><p className="text-lg font-extrabold text-white" style={{ fontFamily: "Manrope" }}>15.2</p><p className="text-[9px] text-white/60">Promedio</p></div>
                      <div className="bg-[#e1b82c] rounded-xl p-2.5 text-center"><p className="text-lg font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>24</p><p className="text-[9px] text-[#001f4b]/60">Docentes</p></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating notification */}
              <div className="absolute -left-6 top-16 bg-white rounded-2xl p-3 shadow-xl shadow-black/10 border border-slate-100 flex items-center gap-3 animate-fade-in-up">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-600" /></div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Asistencia registrada</p>
                  <p className="text-[10px] text-slate-400">3ero A — Hace 2 min</p>
                </div>
              </div>

              {/* Floating rating */}
              <div className="absolute -right-4 top-8 bg-white rounded-2xl p-3 shadow-xl shadow-black/10 border border-slate-100 animate-fade-in-up stagger-2">
                <div className="flex gap-0.5 mb-1">{[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-[#e1b82c] text-[#e1b82c]" />)}</div>
                <p className="text-[10px] font-bold text-slate-700">4.9 de 120+ colegios</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wave divider */}
        <div className="relative -mb-1">
          <svg viewBox="0 0 1440 80" fill="none" className="w-full"><path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill="#f8fafc" /></svg>
        </div>
      </section>

      {/* ═══ Stats ═══ */}
      <section className="py-16 px-6 bg-[#f8fafc]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-[#001f4b]/5 flex items-center justify-center mx-auto mb-3"><Icon className="w-5 h-5 text-[#001f4b]" /></div>
                <p className="text-3xl font-extrabold text-[#001f4b] mb-1" style={{ fontFamily: "Manrope" }}>{s.value}</p>
                <p className="text-xs text-slate-500 font-medium">{s.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ Features with images ═══ */}
      <section id="features" className="py-24 px-6 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">Funcionalidades</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#001f4b] mb-5" style={{ fontFamily: "Manrope" }}>Todo lo que tu colegio necesita</h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto">Una plataforma completa para digitalizar la gestión escolar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                  <div className="h-44 overflow-hidden relative">
                    <img src={f.img} alt={f.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" onError={(e) => { e.target.src = 'https://via.placeholder.com/400x200?text=EduNet'; }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#001f4b]/60 to-transparent" />
                    <div className="absolute bottom-3 left-3 w-10 h-10 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#001f4b]" />
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-[#001f4b] mb-2" style={{ fontFamily: "Manrope" }}>{f.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ How It Works — with background ═══ */}
      <section id="how-it-works" className="py-24 px-6 relative bg-[#001f4b]">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=1920" alt="" className="w-full h-full object-cover opacity-10" />
        </div>
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">Cómo funciona</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ fontFamily: "Manrope" }}>Tu intranet lista en 4 pasos</h2>
            <p className="text-lg text-blue-200/60 max-w-xl mx-auto">Sin complicaciones técnicas. Sin necesidad de un equipo de IT.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/10 transition-colors text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#e1b82c] flex items-center justify-center mx-auto mb-5 shadow-lg shadow-[#e1b82c]/20">
                    <Icon className="w-7 h-7 text-[#001f4b]" />
                  </div>
                  <span className="text-xs font-extrabold text-[#e1b82c] tracking-widest">PASO {s.num}</span>
                  <h3 className="text-lg font-bold text-white mt-2 mb-3" style={{ fontFamily: "Manrope" }}>{s.title}</h3>
                  <p className="text-sm text-blue-200/60 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ Big Image + Text Section ═══ */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">
              <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&q=80&w=700&h=500" alt="Profesor con alumnos" className="w-full h-[420px] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#001f4b]/30 to-transparent" />
            </div>
          </div>
          <div className="flex-1 max-w-lg">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">¿Por qué EduNet?</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#001f4b] mb-6 leading-tight" style={{ fontFamily: "Manrope" }}>
              Diseñado por educadores, para educadores
            </h2>
            <p className="text-slate-500 leading-relaxed mb-8">
              Entendemos los desafíos diarios de gestionar un colegio. EduNet nació de la colaboración directa con directores y coordinadores en Perú para crear la herramienta que realmente necesitan.
            </p>
            <div className="space-y-4">
              {["Reduce el tiempo administrativo en un 60%", "Mejora la comunicación con padres al instante", "Reportes automáticos sin trabajo manual", "Accesible desde cualquier dispositivo"].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#e1b82c]/20 flex items-center justify-center flex-shrink-0"><CheckCircle className="w-4 h-4 text-[#e1b82c]" /></div>
                  <span className="text-sm font-medium text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Testimonials — with photos ═══ */}
      <section id="testimonials" className="py-24 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068]" />
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=1920" alt="" className="w-full h-full object-cover opacity-8" />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">Testimonios</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ fontFamily: "Manrope" }}>Lo que dicen nuestros clientes</h2>
            <p className="text-lg text-blue-200/60">Colegios reales que ya transformaron su gestión.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-8 shadow-xl">
                <div className="flex gap-0.5 mb-5">{Array.from({ length: t.stars }).map((_, i) => <Star key={i} className="w-4 h-4 fill-[#e1b82c] text-[#e1b82c]" />)}</div>
                <p className="text-sm text-slate-600 leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-5 border-t border-slate-100">
                  <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover border-2 border-[#e1b82c]/30" onError={(e) => { e.target.src = 'https://via.placeholder.com/48'; }} />
                  <div>
                    <p className="text-sm font-bold text-[#001f4b]">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.role}</p>
                    <p className="text-[11px] text-[#e1b82c] font-medium">{t.school}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Pricing ═══ */}
      <section id="pricing" className="py-24 px-6 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">Planes</span>
            <h2 className="text-4xl md:text-5xl font-extrabold text-[#001f4b] mb-5" style={{ fontFamily: "Manrope" }}>Un plan para cada colegio</h2>
            <p className="text-lg text-slate-500">Sin contratos. Cancela cuando quieras.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((p) => (
              <div key={p.name} className={`relative rounded-2xl p-8 border transition-all hover:-translate-y-1 hover:shadow-xl ${p.popular ? "bg-[#001f4b] text-white border-[#001f4b] shadow-2xl shadow-[#001f4b]/20 scale-[1.03]" : "bg-white border-slate-200 shadow-sm"}`}>
                {p.popular && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#e1b82c] text-[#001f4b] text-[10px] font-extrabold uppercase tracking-widest px-4 py-1 rounded-full">Más popular</div>}
                <h3 className={`text-lg font-bold mb-1 ${p.popular ? "text-white" : "text-[#001f4b]"}`} style={{ fontFamily: "Manrope" }}>{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className={`text-4xl font-extrabold ${p.popular ? "text-white" : "text-[#001f4b]"}`} style={{ fontFamily: "Manrope" }}>{p.price}</span>
                  {p.period && <span className={`text-sm ${p.popular ? "text-blue-200/60" : "text-slate-400"}`}>{p.period}</span>}
                </div>
                <p className={`text-sm mb-6 ${p.popular ? "text-blue-200/60" : "text-slate-500"}`}>{p.desc}</p>
                <ul className="space-y-3 mb-8">
                  {p.features.map((feat) => <li key={feat} className="flex items-center gap-2.5"><CheckCircle className={`w-4 h-4 flex-shrink-0 ${p.popular ? "text-[#e1b82c]" : "text-emerald-500"}`} /><span className={`text-sm ${p.popular ? "text-blue-100/80" : "text-slate-600"}`}>{feat}</span></li>)}
                </ul>
                <Link to="/register" className={`block text-center font-semibold py-3.5 rounded-xl transition-all ${p.popular ? "bg-[#e1b82c] text-[#001f4b] hover:bg-[#e1b82c]/90 shadow-lg" : "bg-[#001f4b] text-white hover:bg-[#001f4b]/90"}`}>{p.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Security ═══ */}
      <section className="py-16 px-6 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[{ icon: Lock, title: "Encriptación AES-256", sub: "Datos protegidos" }, { icon: Shield, title: "Cumplimiento LGPDP", sub: "Normativa peruana" }, { icon: Clock, title: "99.9% Uptime", sub: "Siempre disponible" }, { icon: Phone, title: "Soporte en español", sub: "Respuesta < 1 hora" }].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-[#001f4b] flex items-center justify-center mb-3 shadow-lg shadow-[#001f4b]/10"><Icon className="w-5 h-5 text-[#e1b82c]" /></div>
                <p className="text-xs font-bold text-[#001f4b]">{item.title}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{item.sub}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold text-[#e1b82c] uppercase tracking-widest bg-[#e1b82c]/10 px-4 py-1.5 rounded-full mb-4">FAQ</span>
            <h2 className="text-4xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>Preguntas frecuentes</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-6 text-left" data-testid={`faq-${i}`}>
                  <span className="text-sm font-semibold text-[#001f4b] pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && <div className="px-6 pb-6 -mt-2"><p className="text-sm text-slate-500 leading-relaxed">{faq.a}</p></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Final CTA with Image ═══ */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="https://images.unsplash.com/photo-1571260899304-425eee4c7efc?auto=format&fit=crop&q=80&w=1920" alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[#001f4b]/90" />
        </div>
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ fontFamily: "Manrope" }}>El futuro de tu colegio empieza hoy</h2>
          <p className="text-lg text-blue-200/70 mb-10 max-w-xl mx-auto">Únete a más de 120 colegios que ya transformaron su gestión con EduNet.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="group inline-flex items-center justify-center gap-2 bg-[#e1b82c] text-[#001f4b] font-bold px-10 py-4 rounded-2xl text-base transition-all hover:-translate-y-1 shadow-xl shadow-[#e1b82c]/20" data-testid="cta-register-btn">Crear mi cuenta gratis <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-white font-semibold px-10 py-4 rounded-2xl text-base hover:bg-white/10 transition-all" data-testid="cta-login-btn">Ingresar a mi Intranet</Link>
          </div>
          <p className="text-xs text-blue-200/30 mt-8">Sin tarjeta de crédito · Sin contratos · Cancela cuando quieras</p>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="py-12 px-6 bg-[#001636] text-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-[#e1b82c] flex items-center justify-center"><GraduationCap className="w-4 h-4 text-[#001f4b]" /></div>
                <span className="text-base font-extrabold" style={{ fontFamily: "Manrope" }}>EduNet</span>
              </div>
              <p className="text-xs text-blue-200/40 leading-relaxed">La plataforma de intranet escolar más confiable de Perú.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Producto</p>
              <div className="space-y-2 text-xs text-blue-200/50">
                <p className="hover:text-white cursor-pointer transition-colors">Funcionalidades</p>
                <p className="hover:text-white cursor-pointer transition-colors">Planes y precios</p>
                <p className="hover:text-white cursor-pointer transition-colors">Seguridad</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Soporte</p>
              <div className="space-y-2 text-xs text-blue-200/50">
                <p className="hover:text-white cursor-pointer transition-colors">Centro de ayuda</p>
                <p className="hover:text-white cursor-pointer transition-colors">Contacto</p>
                <p className="hover:text-white cursor-pointer transition-colors">Estado del servicio</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#e1b82c] mb-3">Legal</p>
              <div className="space-y-2 text-xs text-blue-200/50">
                <p className="hover:text-white cursor-pointer transition-colors">Términos de servicio</p>
                <p className="hover:text-white cursor-pointer transition-colors">Privacidad</p>
                <p className="hover:text-white cursor-pointer transition-colors">Protección de datos</p>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-blue-200/30">EduNet &copy; 2026 — Todos los derechos reservados. Lima, Perú.</p>
            <div className="flex items-center gap-4">
              <Mail className="w-4 h-4 text-blue-200/30 hover:text-[#e1b82c] cursor-pointer transition-colors" />
              <Phone className="w-4 h-4 text-blue-200/30 hover:text-[#e1b82c] cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
