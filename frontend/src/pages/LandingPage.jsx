import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Users, BarChart3, Calendar, MessageSquare, BookOpen,
  ChevronRight, CheckCircle, Star, ArrowRight, GraduationCap,
  Lock, Zap, Globe, Phone, Mail, Clock, Award, TrendingUp,
  ChevronDown, Sparkles, Play, ArrowUpRight, Check, Calculator, QrCode, Monitor,
} from "lucide-react";

const stats = [
  { value: "120+", label: "Colegios activos", icon: GraduationCap },
  { value: "45K+", label: "Usuarios conectados", icon: Users },
  { value: "99.9%", label: "Uptime garantizado", icon: TrendingUp },
  { value: "4.9/5", label: "Satisfacción", icon: Star },
];

const features = [
  { icon: Users, title: "Gestión de Comunidad", desc: "Conecta padres, docentes y directivos en un solo lugar seguro.", color: "from-blue-500 to-cyan-400" },
  { icon: BarChart3, title: "Reportes en Tiempo Real", desc: "Métricas de asistencia, calificaciones y desempeño al instante.", color: "from-violet-500 to-purple-400" },
  { icon: Calendar, title: "Calendario Integrado", desc: "Eventos, reuniones y actividades académicas sincronizadas.", color: "from-amber-500 to-orange-400" },
  { icon: MessageSquare, title: "Comunicación Directa", desc: "Mensajería institucional sin depender de WhatsApp.", color: "from-emerald-500 to-teal-400" },
  { icon: BookOpen, title: "Recursos Académicos", desc: "Biblioteca digital, tareas y materiales centralizados.", color: "from-rose-500 to-pink-400" },
  { icon: Shield, title: "Seguridad Total", desc: "Encriptación de datos y control de acceso por roles.", color: "from-slate-600 to-slate-400" },
];

const steps = [
  { num: "01", title: "Crea tu cuenta", desc: "Regístrate en menos de 60 segundos.", icon: Zap },
  { num: "02", title: "Configura tu intranet", desc: "Elige tu subdominio personalizado.", icon: Globe },
  { num: "03", title: "Invita a tu comunidad", desc: "Agrega docentes, personal y padres.", icon: Users },
  { num: "04", title: "¡Listo!", desc: "Empieza a usar todas las herramientas.", icon: Award },
];

const testimonials = [
  { name: "María Torres Gutiérrez", role: "Directora General", school: "Colegio San Martín de Porres, Lima", text: "EduNet transformó la comunicación en nuestro colegio. Los padres ahora están informados en tiempo real. Redujimos quejas en un 80%.", stars: 5 },
  { name: "Carlos Mendoza Rivera", role: "Administrador", school: "I.E. Los Andes, Arequipa", text: "La plataforma es increíblemente intuitiva. En una semana ya teníamos todo funcionando. El soporte es excepcional.", stars: 5 },
  { name: "Ana Flores Castillo", role: "Coordinadora Académica", school: "Colegio Santa Rosa, Trujillo", text: "Los reportes automáticos nos ahorran 15+ horas semanales. Calificaciones y asistencias ahora centralizadas.", stars: 5 },
];

const faqs = [
  { q: "¿Cuánto tiempo toma implementar EduNet?", a: "La configuración inicial toma menos de 5 minutos. El onboarding completo se puede completar en 1-2 días hábiles." },
  { q: "¿Mis datos están seguros?", a: "Usamos encriptación AES-256, servidores con certificación SOC 2, y cumplimos con las normativas de protección de datos de Perú." },
  { q: "¿Los padres necesitan descargar alguna app?", a: "No. EduNet funciona 100% desde el navegador web, en computadoras y celulares." },
  { q: "¿Puedo migrar desde mi sistema actual?", a: "Sí. Nuestro equipo te ayuda con la migración de datos sin costo adicional en el plan Profesional." },
];

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);



function BenefitsVideoSection() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] bg-[#e1b82c]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-[950px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/10 px-4 py-2 rounded-full mb-6">
            <Play className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Beneficios de la plataforma</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4">
            Descubre lo que <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">EduNet puede hacer</span>
          </h2>
          <p className="text-base sm:text-lg text-white/40 max-w-xl mx-auto">
            Mira cómo nuestra plataforma transforma la gestión escolar
          </p>
        </div>

        {/* Video container with border and mask */}
        <div className="relative group">
          {/* Glow behind */}
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/25 via-violet-500/15 to-[#e1b82c]/15 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />

          {/* Outer border frame */}
          <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-white/20 via-white/10 to-white/5">
            <div className="rounded-[14px] overflow-hidden bg-[#0a0f1a]">
              {/* Aspect ratio container */}
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                {!playing ? (
                  <>
                    <img
                      src="https://img.youtube.com/vi/JnGyq-ik60w/maxresdefault.jpg"
                      alt="Video EduNet"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/30" />

                    {/* Top bar mask (hides YouTube branding) */}
                    <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-[#0a0f1a] to-transparent z-10" />
                    {/* Bottom bar mask */}
                    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0f1a] to-transparent z-10" />

                    {/* Play button */}
                    <div className="absolute inset-0 flex items-center justify-center z-20">
                      <button
                        onClick={() => setPlaying(true)}
                        className="group/btn relative"
                        data-testid="video-play-btn"
                      >
                        <div className="absolute inset-0 bg-white/20 rounded-full scale-100 group-hover/btn:scale-150 transition-transform duration-700 blur-2xl" />
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/15 backdrop-blur-md border-2 border-white/30 flex items-center justify-center group-hover/btn:bg-white/25 group-hover/btn:border-white/50 group-hover/btn:scale-110 transition-all duration-300 shadow-2xl shadow-black/40">
                          <Play className="w-8 h-8 sm:w-10 sm:h-10 text-white fill-white ml-1" />
                        </div>
                      </button>
                    </div>
                  </>
                ) : (
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src="https://www.youtube.com/embed/JnGyq-ik60w?autoplay=1&rel=0&modestbranding=1&showinfo=0"
                    title="Beneficios de EduNet"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    data-testid="benefits-video"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Benefits grid below video */}
        <div className="mt-14">
          <p className="text-center text-sm text-white/40 mb-8 max-w-2xl mx-auto">
            EduNet es una intranet moderna diseñada para digitalizar la gestión escolar. Con nuestra plataforma tu colegio podrá:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: QrCode, text: "Asistencia con QR" },
              { icon: Users, text: "Gestión de alumnos y profesores" },
              { icon: BookOpen, text: "Tareas y calificaciones" },
              { icon: MessageSquare, text: "Comunicados y avisos" },
              { icon: BarChart3, text: "Reportes en tiempo real" },
              { icon: Shield, text: "Todo centralizado" },
              { icon: Monitor, text: "Celular, tablet o PC" },
              { icon: GraduationCap, text: "Inicial, primaria y secundaria" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <Icon className="w-4 h-4 text-blue-400/60 shrink-0" />
                <span className="text-xs text-white/45">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PriceCalculator() {
  const [students, setStudents] = useState("");
  const numStudents = parseInt(students) || 0;
  const hasInput = students.length > 0 && numStudents > 0;
  const monthlyPrice = hasInput
    ? (numStudents < 80 ? 50 : Math.round(numStudents * 0.70))
    : null;

  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-8 sm:p-10 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#e1b82c]/15 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-[#e1b82c]" />
        </div>
        <h3 className="text-lg font-bold text-white">Calcula tu precio</h3>
      </div>
      <p className="text-sm text-white/40 mb-8">Ingresa la cantidad de alumnos y calcula tu precio mensual.</p>

      {/* Input */}
      <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Cantidad de alumnos</label>
      <input
        type="number"
        min="1"
        value={students}
        onChange={(e) => setStudents(e.target.value)}
        placeholder="Ej: 200"
        className="w-full px-5 py-4 bg-white/[0.06] border border-white/10 rounded-xl text-white text-lg font-semibold placeholder:text-white/20 focus:outline-none focus:border-[#e1b82c]/50 focus:ring-2 focus:ring-[#e1b82c]/20 transition-all mb-6"
        data-testid="calculator-input"
      />

      {/* Result area */}
      {monthlyPrice !== null ? (
        <div className="text-center py-6 mb-6 rounded-xl bg-gradient-to-br from-[#e1b82c]/10 to-amber-500/5 border border-[#e1b82c]/20" data-testid="calculator-result-box">
          <p className="text-xs text-white/40 uppercase tracking-wider font-bold mb-1">Tu precio estimado</p>
          <p className="text-sm text-white/50 mb-3">{numStudents} alumnos</p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-extrabold text-white" data-testid="calculator-result">S/{monthlyPrice}</span>
            <span className="text-base text-white/40 font-medium">/ mes</span>
          </div>
          <p className="text-xs text-white/30 mt-3">Precio aplicable a partir del tercer mes de uso</p>
        </div>
      ) : (
        <div className="mb-6">
          <p className="text-xs text-white/40 uppercase tracking-wider font-bold mb-4 text-center">Ejemplos de precio</p>
          <div className="space-y-2.5">
            {[
              { s: 50, p: 50 },
              { s: 80, p: 56 },
              { s: 200, p: 140 },
            ].map((ex) => (
              <div key={ex.s} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-sm text-white/50">{ex.s} alumnos</span>
                <span className="text-sm font-bold text-[#e1b82c]">S/{ex.p} / mes</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promo note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-8">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white/70">Primeros 2 meses: Solo S/50</p>
          <p className="text-xs text-white/30">Luego el precio se calcula según la cantidad de alumnos.</p>
        </div>
      </div>

      {/* CTA */}
      <Link
        to="/register"
        className="block text-center font-bold py-3.5 rounded-xl bg-gradient-to-r from-[#e1b82c] to-amber-400 text-[#0a0f1a] hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all mb-3"
        data-testid="calculator-cta"
      >
        Iniciar prueba
      </Link>
      <p className="text-center text-xs text-white/25">Sin contratos. Cancela cuando quieras.</p>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-[#0a0f1a] overflow-x-hidden" data-testid="landing-page">

      {/* ═══════════════════════════════════════════════════════════════════════
          NAVBAR - Glassmorphism sticky
      ═══════════════════════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-[72px]">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] to-amber-400 rounded-xl blur-md opacity-60 group-hover:opacity-100 transition-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-[#e1b82c] to-amber-500 flex items-center justify-center shadow-lg">
                <GraduationCap className="w-5 h-5 text-[#0a0f1a]" />
              </div>
            </div>
            <span className="text-xl font-extrabold text-white tracking-tight" data-testid="landing-brand">EduNet</span>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Funcionalidades</a>
            <a href="#how-it-works" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Cómo funciona</a>
            <a href="#testimonials" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Testimonios</a>
            <a href="#pricing" className="text-sm font-medium text-white/50 hover:text-white transition-colors">Planes</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-white/70 hover:text-white transition-colors px-4 py-2.5" data-testid="landing-login-btn">
              Ingresar
            </Link>
            <a href="#hero-form" className="group relative text-sm font-bold px-6 py-2.5 rounded-xl overflow-hidden" data-testid="landing-register-btn">
              <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] to-amber-400 transition-transform group-hover:scale-105" />
              <span className="relative text-[#0a0f1a]">Solicitar demo</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO - Full immersive dark with gradient mesh
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-screen flex items-center pt-[72px] overflow-hidden">
        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#1e40af]/30 rounded-full blur-[120px]" />
          <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-[#7c3aed]/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#e1b82c]/10 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#0ea5e9]/10 rounded-full blur-[150px]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 lg:py-32">
          <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-20">
            {/* Left - Text Content */}
            <div className="flex-1 text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 bg-white/[0.05] border border-white/10 px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 text-[#e1b82c]" />
                <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Plataforma #1 en Perú</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] mb-6" data-testid="landing-hero-title">
                La intranet que
                <span className="relative inline-block ml-3">
                  <span className="relative z-10 bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400 bg-clip-text text-transparent">transforma</span>
                  <div className="absolute -bottom-2 left-0 right-0 h-3 bg-gradient-to-r from-[#e1b82c]/40 to-orange-400/40 blur-lg" />
                </span>
                <br />tu colegio
              </h1>

              {/* QR description */}
              <div className="flex items-start gap-4 mb-10 max-w-xl mx-auto lg:mx-0">
                <div className="shrink-0 mt-1">
                  <QrCode className="w-12 h-12 text-[#e1b82c]/80" />
                </div>
                <p className="text-base sm:text-lg text-white/50 leading-relaxed">
                  Controla la asistencia de tus alumnos con códigos QR en segundos.
                  <br />Escanea desde el celular y registra entradas automáticamente.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10">
                <a href="#hero-form" className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-base overflow-hidden" data-testid="hero-register-btn">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-[#e1b82c] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative text-[#0a0f1a]">Solicitar demo</span>
                  <ArrowRight className="relative w-5 h-5 text-[#0a0f1a] group-hover:translate-x-1 transition-transform" />
                </a>
                <Link to="/login" className="group inline-flex items-center justify-center gap-3 bg-white/[0.05] border border-white/10 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all hover:bg-white/10 hover:border-white/20 backdrop-blur-sm" data-testid="hero-login-btn">
                  <Play className="w-5 h-5 fill-white/50" />
                  Ingresar a mi Intranet
                </Link>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-white/40">
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Sin tarjeta</span>
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> 5 min setup</span>
                <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /> Soporte español</span>
              </div>
            </div>

            {/* Right - Device Mockups + Registration Form */}
            <div className="flex-1 max-w-2xl w-full">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-6 bg-gradient-to-r from-[#1e40af]/40 via-[#7c3aed]/20 to-[#e1b82c]/20 rounded-[2rem] blur-3xl opacity-60" />
                
                <div className="relative flex items-start">
                  {/* Device mockups - laptop + phone */}
                  <div className="relative flex-shrink-0 w-[50%]">
                    {/* Laptop mockup */}
                    <div className="relative">
                      <img 
                        src="https://customer-assets.emergentagent.com/job_d0ea565a-5ab8-49d6-8b8e-5c0e85764ea0/artifacts/3qb8ccoe_image%20%282%29.webp"
                        alt="EduNet Dashboard"
                        className="w-full h-auto rounded-xl shadow-2xl shadow-black/40"
                        data-testid="hero-dashboard-image"
                      />
                    </div>
                    
                    {/* Phone mockup - overlapping */}
                    <div className="absolute -bottom-6 -left-6 w-[48%] z-10">
                      <div className="relative bg-black rounded-[1.6rem] p-[5px] shadow-2xl shadow-black/60 border border-white/10">
                        {/* Phone notch */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40%] h-[14px] bg-black rounded-b-xl z-20" />
                        {/* Phone screen */}
                        <div className="rounded-[1.3rem] overflow-hidden bg-gradient-to-b from-[#1a1f3a] to-[#0d1225]">
                          <div className="p-2.5 pt-5">
                            <p className="text-[6px] text-white/60 text-center font-semibold mb-0.5">Escanea para Marcar</p>
                            <p className="text-[8px] text-white text-center font-bold mb-1.5">Asistencia</p>
                            {/* QR placeholder */}
                            <div className="mx-auto w-[75%] aspect-square bg-white rounded-md flex items-center justify-center mb-1.5">
                              <QrCode className="w-[55%] h-[55%] text-[#0a0f1a]" />
                            </div>
                            <div className="flex justify-center gap-1.5 mt-1">
                              <div className="bg-emerald-500/20 rounded-full px-1.5 py-0.5">
                                <p className="text-[5px] text-emerald-400 font-bold">34</p>
                              </div>
                              <div className="bg-blue-500/20 rounded-full px-1.5 py-0.5">
                                <p className="text-[5px] text-blue-400 font-bold">11</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Registration Form Card */}
                  <div id="hero-form" className="relative flex-1 -ml-6 mt-2 z-20" data-testid="hero-demo-form">
                    <div className="bg-[#111827]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
                      <h3 className="text-base font-bold text-white mb-0.5">
                        Prueba EduNet <span className="text-[#e1b82c]">en tu colegio</span>
                      </h3>
                      <p className="text-[11px] text-white/40 mb-4">Crea tu intranet escolar en minutos.</p>
                      
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          placeholder="Nombre del colegio"
                          className="w-full px-3.5 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#e1b82c]/50 transition-colors"
                          data-testid="demo-school-name"
                        />
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1 bg-white/[0.06] border border-white/10 rounded-xl px-2.5 py-2.5 shrink-0">
                            <span className="text-xs text-white/60 font-medium">PE +51</span>
                          </div>
                          <input
                            type="tel"
                            placeholder="987 654 321"
                            className="flex-1 px-3.5 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#e1b82c]/50 transition-colors"
                            data-testid="demo-phone"
                          />
                        </div>
                        <input
                          type="email"
                          placeholder="Correo electrónico"
                          className="w-full px-3.5 py-2.5 bg-white/[0.06] border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[#e1b82c]/50 transition-colors"
                          data-testid="demo-email"
                        />
                      </div>
                      
                      <button
                        className="w-full mt-3.5 py-3 rounded-xl bg-gradient-to-r from-[#e1b82c] to-amber-400 text-[#0a0f1a] font-extrabold text-sm uppercase tracking-wider hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all"
                        data-testid="demo-submit-btn"
                      >
                        Probar EduNet
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom gradient fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0f1a] to-transparent" />
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          STATS - Floating cards with gradients
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((s, i) => {
              const Icon = s.icon;
              const colors = ["from-blue-600 to-cyan-500", "from-violet-600 to-purple-500", "from-emerald-600 to-teal-500", "from-amber-500 to-orange-500"];
              return (
                <div key={s.label} className="group relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${colors[i]} rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity`} />
                  <div className="relative bg-white/[0.03] backdrop-blur-sm rounded-2xl p-6 border border-white/5 hover:border-white/10 transition-colors">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[i]} flex items-center justify-center mb-4 shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-3xl sm:text-4xl font-extrabold text-white mb-1">{s.value}</p>
                    <p className="text-sm text-white/40">{s.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES - Bento grid with colorful icons
      ═══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative py-24 px-6 overflow-hidden">
        {/* Background accents */}
        <div className="absolute top-1/2 left-0 w-[400px] h-[400px] bg-[#1e40af]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-[#e1b82c]/10 rounded-full blur-[100px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Funcionalidades</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
              Todo lo que tu colegio <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">necesita</span>
            </h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">Una plataforma completa para digitalizar la gestión escolar.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.color} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`} />
                  <div className="relative h-full bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-sm rounded-2xl p-7 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          HOW IT WORKS - Horizontal timeline with gradient
      ═══════════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative py-24 px-6 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3b0764]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M0 0h30v30H0z%22 fill=%22none%22/%3E%3Ccircle cx=%221%22 cy=%221%22 r=%221%22 fill=%22rgba(255,255,255,0.03)%22/%3E%3C/svg%3E')]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 px-4 py-2 rounded-full mb-6">
              <Zap className="w-4 h-4 text-[#e1b82c]" />
              <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Cómo funciona</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
              Tu intranet lista en <span className="text-[#e1b82c]">4 pasos</span>
            </h2>
            <p className="text-lg text-blue-200/50 max-w-xl mx-auto">Sin complicaciones técnicas. Sin necesidad de un equipo de IT.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="relative group">
                  {/* Connection line */}
                  {i < 3 && <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-white/20 to-transparent z-0" />}
                  
                  <div className="relative bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-2xl p-8 hover:bg-white/[0.08] transition-all hover:-translate-y-1">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#e1b82c] to-amber-500 flex items-center justify-center mb-6 shadow-xl shadow-[#e1b82c]/20 group-hover:scale-110 transition-transform">
                      <Icon className="w-7 h-7 text-[#0a0f1a]" />
                    </div>
                    <span className="text-xs font-extrabold text-[#e1b82c] tracking-widest">PASO {s.num}</span>
                    <h3 className="text-lg font-bold text-white mt-2 mb-3">{s.title}</h3>
                    <p className="text-sm text-blue-200/50 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHY EDUNET - Split section with gradient placeholder
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            {/* Left - Visual */}
            <div className="flex-1 w-full max-w-lg">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-blue-600/30 via-purple-600/20 to-amber-500/20 rounded-3xl blur-2xl" />
                <div className="relative aspect-[4/3] rounded-3xl bg-gradient-to-br from-[#1e40af] via-[#3b0764] to-[#0a0f1a] overflow-hidden border border-white/10">
                  {/* Abstract shapes */}
                  <div className="absolute top-8 left-8 w-20 h-20 rounded-2xl bg-gradient-to-br from-[#e1b82c] to-amber-500 opacity-80" />
                  <div className="absolute top-16 left-20 w-32 h-32 rounded-full bg-gradient-to-br from-blue-500/50 to-cyan-400/50 blur-sm" />
                  <div className="absolute bottom-12 right-12 w-24 h-24 rounded-2xl bg-gradient-to-br from-emerald-500/60 to-teal-400/60 rotate-12" />
                  <div className="absolute bottom-8 left-16 w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500/70 to-purple-400/70 -rotate-6" />
                  
                  {/* Central icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center">
                      <GraduationCap className="w-12 h-12 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Content */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-white/10 px-4 py-2 rounded-full mb-6">
                <Award className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white/60 uppercase tracking-wider">¿Por qué EduNet?</span>
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-6 leading-tight">
                Diseñado por educadores,<br />
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">para educadores</span>
              </h2>
              
              <p className="text-white/40 leading-relaxed mb-8 max-w-md">
                Entendemos los desafíos diarios de gestionar un colegio. EduNet nació de la colaboración directa con directores y coordinadores en Perú.
              </p>
              
              <div className="space-y-4">
                {[
                  "Reduce el tiempo administrativo en un 60%",
                  "Mejora la comunicación con padres al instante",
                  "Reportes automáticos sin trabajo manual",
                  "Accesible desde cualquier dispositivo"
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 group">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-medium text-white/70">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TESTIMONIALS - Cards with gradient accents
      ═══════════════════════════════════════════════════════════════════════ */}
      <section id="testimonials" className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]" />
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#7c3aed]/20 rounded-full blur-[150px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-white/10 px-4 py-2 rounded-full mb-6">
              <Star className="w-4 h-4 text-violet-400 fill-violet-400" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Testimonios</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
              Lo que dicen <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">nuestros clientes</span>
            </h2>
            <p className="text-lg text-white/40">Colegios reales que ya transformaron su gestión.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => {
              const accents = ["from-blue-500/20 to-cyan-500/20", "from-violet-500/20 to-purple-500/20", "from-amber-500/20 to-orange-500/20"];
              return (
                <div key={t.name} className="group relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${accents[i]} rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="relative bg-white/[0.03] backdrop-blur-sm rounded-2xl p-8 border border-white/5 hover:border-white/10 transition-all h-full">
                    <div className="flex gap-1 mb-5">
                      {Array.from({ length: t.stars }).map((_, j) => (
                        <Star key={j} className="w-4 h-4 fill-[#e1b82c] text-[#e1b82c]" />
                      ))}
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed mb-6">"{t.text}"</p>
                    <div className="pt-5 border-t border-white/5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                          {t.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">{t.name}</p>
                          <p className="text-xs text-white/40">{t.role}</p>
                          <p className="text-xs text-[#e1b82c]">{t.school}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>


      {/* ═══════════════════════════════════════════════════════════════════════
          BENEFITS - Fullscreen Video section
      ═══════════════════════════════════════════════════════════════════════ */}
      <BenefitsVideoSection />

      {/* ═══════════════════════════════════════════════════════════════════════
          PRICING - Single clear model
      ═══════════════════════════════════════════════════════════════════════ */}
      <section id="pricing" className="relative py-24 px-6 overflow-hidden">
        <div className="absolute bottom-0 left-1/3 w-[400px] h-[400px] bg-[#e1b82c]/10 rounded-full blur-[120px]" />
        <div className="absolute top-20 right-1/4 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px]" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-white/10 px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">Precios</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-5">
              Un precio justo para <span className="bg-gradient-to-r from-[#e1b82c] to-amber-400 bg-clip-text text-transparent">cada colegio</span>
            </h2>
            <p className="text-lg text-white/40 max-w-xl mx-auto">
              Empieza por solo S/50 durante los primeros 2 meses.<br />
              Luego paga solo S/0.70 por alumno al mes.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* LEFT — Pricing card */}
            <div className="relative">
              <div className="absolute -inset-[2px] bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400 rounded-2xl" />
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#e1b82c] to-amber-400 text-[#0a0f1a] text-[10px] font-extrabold uppercase tracking-widest px-5 py-1.5 rounded-full shadow-lg z-10">
                Sin contratos
              </div>
              <div className="relative rounded-2xl bg-[#0a0f1a] p-8 sm:p-10">
                <h3 className="text-xl font-bold text-white mb-6">EduNet</h3>
                
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-5xl sm:text-6xl font-extrabold text-white">S/50</span>
                  <span className="text-base text-white/40 font-medium">/ mes</span>
                </div>
                <p className="text-sm text-[#e1b82c] font-semibold mb-6">Primeros 2 meses</p>

                <div className="border-t border-white/10 my-6" />

                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-extrabold text-white">S/0.70</span>
                  <span className="text-sm text-white/40 font-medium">por alumno / mes</span>
                </div>
                <p className="text-sm text-white/40 mb-8">A partir del 3er mes</p>

                <ul className="space-y-3 mb-8">
                  {[
                    "Asistencia con código QR",
                    "Gestión de alumnos",
                    "Gestión de profesores",
                    "Comunicación con padres",
                    "Tareas y calificaciones",
                    "Reportes académicos",
                    "Acceso desde celular y computadora",
                    "Subdominio para el colegio",
                    "Soporte técnico"
                  ].map((feat) => (
                    <li key={feat} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#e1b82c]/20 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-[#e1b82c]" />
                      </div>
                      <span className="text-sm text-white/60">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link 
                  to="/register" 
                  className="block text-center font-bold py-3.5 rounded-xl bg-gradient-to-r from-[#e1b82c] to-amber-400 text-[#0a0f1a] hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all"
                  data-testid="pricing-cta"
                >
                  Iniciar prueba
                </Link>
              </div>
            </div>

            {/* RIGHT — Calculator */}
            <PriceCalculator />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECURITY BADGES
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Lock, title: "Encriptación AES-256", sub: "Datos protegidos" },
            { icon: Shield, title: "Cumplimiento LGPDP", sub: "Normativa peruana" },
            { icon: Clock, title: "99.9% Uptime", sub: "Siempre disponible" },
            { icon: Phone, title: "Soporte español", sub: "Respuesta < 1 hora" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/10 flex items-center justify-center mb-3 group-hover:border-white/20 transition-colors">
                  <Icon className="w-6 h-6 text-[#e1b82c]" />
                </div>
                <p className="text-sm font-bold text-white">{item.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{item.sub}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FAQ
      ═══════════════════════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 px-4 py-2 rounded-full mb-6">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white/60 uppercase tracking-wider">FAQ</span>
            </div>
            <h2 className="text-4xl font-extrabold text-white">Preguntas frecuentes</h2>
          </div>
          
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors">
                <button 
                  onClick={() => setOpenFaq(openFaq === i ? null : i)} 
                  className="w-full flex items-center justify-between p-6 text-left"
                  data-testid={`faq-${i}`}
                >
                  <span className="text-sm font-semibold text-white pr-4">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-white/40 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 -mt-2">
                    <p className="text-sm text-white/40 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FINAL CTA
      ═══════════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] via-[#3b0764] to-[#1e3a8a]" />
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#e1b82c]/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-6">
            El futuro de tu colegio<br />
            <span className="bg-gradient-to-r from-[#e1b82c] to-amber-400 bg-clip-text text-transparent">empieza hoy</span>
          </h2>
          <p className="text-lg text-blue-100/50 mb-10 max-w-xl mx-auto">
            Únete a más de 120 colegios que ya transformaron su gestión con EduNet.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="group relative inline-flex items-center justify-center gap-2 px-10 py-4 rounded-2xl font-bold text-base overflow-hidden" data-testid="cta-register-btn">
              <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400" />
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-[#e1b82c] opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative text-[#0a0f1a]">Solicitar demo</span>
              <ArrowRight className="relative w-5 h-5 text-[#0a0f1a] group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-white font-semibold px-10 py-4 rounded-2xl text-base hover:bg-white/10 hover:border-white/30 transition-all" data-testid="cta-login-btn">
              Ingresar a mi Intranet
            </Link>
          </div>
          
          <p className="text-xs text-blue-200/30 mt-10">Sin tarjeta de crédito · Sin contratos · Cancela cuando quieras</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════════ */}
      <footer className="py-12 px-6 bg-[#050810] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#e1b82c] to-amber-500 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-[#0a0f1a]" />
                </div>
                <span className="text-base font-extrabold text-white">EduNet</span>
              </div>
              <p className="text-xs text-white/30 leading-relaxed">La plataforma de intranet escolar más confiable de Perú.</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Producto</p>
              <div className="space-y-2.5 text-sm text-white/30">
                <p className="hover:text-white cursor-pointer transition-colors">Funcionalidades</p>
                <p className="hover:text-white cursor-pointer transition-colors">Planes y precios</p>
                <p className="hover:text-white cursor-pointer transition-colors">Seguridad</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Soporte</p>
              <div className="space-y-2.5 text-sm text-white/30">
                <p className="hover:text-white cursor-pointer transition-colors">Centro de ayuda</p>
                <p className="hover:text-white cursor-pointer transition-colors">Contacto</p>
                <p className="hover:text-white cursor-pointer transition-colors">Estado del servicio</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-white/50 mb-4">Legal</p>
              <div className="space-y-2.5 text-sm text-white/30">
                <p className="hover:text-white cursor-pointer transition-colors">Términos de servicio</p>
                <p className="hover:text-white cursor-pointer transition-colors">Privacidad</p>
                <p className="hover:text-white cursor-pointer transition-colors">Protección de datos</p>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/20">EduNet © 2026 — Todos los derechos reservados. Lima, Perú.</p>
            <div className="flex items-center gap-4">
              <Mail className="w-4 h-4 text-white/20 hover:text-[#e1b82c] cursor-pointer transition-colors" />
              <Phone className="w-4 h-4 text-white/20 hover:text-[#e1b82c] cursor-pointer transition-colors" />
            </div>
          </div>
        </div>
      </footer>

      {/* Custom animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float-delayed 4s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>

      {/* WhatsApp floating button */}
      <a
        href="https://wa.me/51992021294"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-0 group"
        data-testid="whatsapp-float-btn"
      >
        {/* Text tooltip */}
        <span className="bg-white text-slate-800 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg mr-[-8px] opacity-0 group-hover:opacity-100 group-hover:mr-2 transition-all duration-300 whitespace-nowrap">
          Chatea con nosotros
        </span>
        {/* Circle icon */}
        <div className="w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] flex items-center justify-center shadow-lg shadow-[#25D366]/40 hover:shadow-xl hover:shadow-[#25D366]/50 transition-all hover:scale-110">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
      </a>
    </div>
  );
}
