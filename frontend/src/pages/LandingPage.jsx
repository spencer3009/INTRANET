import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Shield, Users, BarChart3, MessageSquare, BookOpen,
  ChevronDown, CheckCircle, Star, ArrowRight, GraduationCap,
  Lock, Zap, Globe, Phone, Mail, Clock, Award, TrendingUp,
  Sparkles, Play, Check, Calculator, QrCode, Monitor,
  LayoutDashboard, DollarSign, Smartphone, FileText,
  ClipboardList, PenSquare, Ban, Calendar, Send, FolderOpen,
} from "lucide-react";

const stats = [
  { value: "120+", label: "Colegios activos", icon: GraduationCap },
  { value: "45K+", label: "Usuarios conectados", icon: Users },
  { value: "99.9%", label: "Uptime garantizado", icon: TrendingUp },
  { value: "4.9/5", label: "Satisfacción", icon: Star },
];

const features = [
  { icon: LayoutDashboard, title: "Panel Principal Inteligente", desc: "Dashboard en tiempo real con avisos, actividades, eventos, tareas y notificaciones. Cada usuario ve información personalizada según su rol.", color: "from-blue-500 to-cyan-400" },
  { icon: Users, title: "Gestión Completa de Usuarios", desc: "Administra estudiantes, profesores, padres, coordinadores y administradores. Cada usuario tiene acceso con permisos específicos.", color: "from-violet-500 to-purple-400" },
  { icon: GraduationCap, title: "Gestión Académica", desc: "Organiza niveles, grados, secciones, asignaturas, asignación de profesores y horarios. Todo conectado para facilitar la administración.", color: "from-amber-500 to-yellow-400" },
  { icon: ClipboardList, title: "Sistema de Tareas", desc: "Profesores publican tareas con archivos adjuntos y fecha de entrega. Los alumnos entregan digitalmente y los padres pueden visualizarlas.", color: "from-teal-500 to-emerald-400" },
  { icon: PenSquare, title: "Sistema de Evaluaciones", desc: "Crea exámenes con preguntas de selección múltiple, evaluaciones digitales, resultados automáticos e historial completo.", color: "from-rose-500 to-pink-400" },
  { icon: BarChart3, title: "Registro de Calificaciones", desc: "Registro de notas por curso, cálculo automático de promedios, historial académico con acceso para padres y estudiantes.", color: "from-blue-600 to-indigo-400" },
  { icon: QrCode, title: "Asistencia con Código QR", desc: "Cada alumno tiene su código QR. Escaneo rápido desde el celular, registro automático de ingreso y salida, reportes diarios e historial.", color: "from-violet-600 to-purple-400" },
  { icon: DollarSign, title: "Zona de Finanzas", desc: "Gestiona matrículas, pensiones, control de pagos, historial financiero, morosidad y reportes económicos por estudiante.", color: "from-green-500 to-lime-400" },
  { icon: Ban, title: "Control de Acceso por Pagos", desc: "Si un alumno no ha pagado, el sistema limita su acceso. Al regularizar el pago, recupera acceso completo automáticamente.", color: "from-red-500 to-rose-400" },
  { icon: Calendar, title: "Calendario Escolar", desc: "Calendario centralizado con actividades, exámenes, eventos institucionales, reuniones y fechas importantes según el rol del usuario.", color: "from-orange-500 to-amber-400" },
  { icon: Send, title: "Noticias y Comunicados", desc: "Pública anuncios institucionales, comunicados para padres, noticias del colegio e información sobre actividades.", color: "from-pink-500 to-fuchsia-400" },
  { icon: BarChart3, title: "Encuestas", desc: "Crea encuestas, recibe respuestas de padres y estudiantes, analiza resultados y mejora los procesos educativos.", color: "from-cyan-500 to-teal-400" },
  { icon: FolderOpen, title: "Biblioteca de Archivos", desc: "Los profesores comparten documentos, material de estudio, guías y recursos educativos para los estudiantes.", color: "from-purple-500 to-violet-400" },
  { icon: MessageSquare, title: "Comunicación Interna", desc: "Mensajes entre profesores y padres, comunicaciones institucionales y notificaciones automáticas.", color: "from-blue-500 to-sky-400" },
  { icon: Smartphone, title: "Acceso desde Celular", desc: "Compatible con celulares, interfaz optimizada para móvil, instalación como aplicación. Acceso desde cualquier lugar.", color: "from-green-500 to-emerald-400" },
  { icon: FileText, title: "Boletas de Notas Automáticas", desc: "Genera boletas individuales, promedios por curso, consolidados por grado y sección. Exporta reportes académicos de forma rápida y profesional.", color: "from-blue-600 to-indigo-400" },
  { icon: TrendingUp, title: "Reportes y Estadísticas", desc: "Reportes de asistencia, rendimiento académico, estadísticas por curso y grado. Seguimiento del progreso para detectar problemas a tiempo.", color: "from-amber-600 to-yellow-400" },
  { icon: Lock, title: "Seguridad y Control", desc: "Acceso con usuario y contraseña, permisos según rol, protección de datos y control de acceso a la información.", color: "from-slate-600 to-slate-400" },
];

const steps = [
  { num: "01", title: "Realiza tu registro y pago", desc: "El colegio realiza el pago de S/50 de inscripción. Inmediatamente recibirás tu comprobante o factura electrónica.", icon: DollarSign },
  { num: "02", title: "Envíanos los datos de tu institución", desc: "Nombre del colegio, logo institucional, niveles educativos y datos de contacto para personalizar tu plataforma.", icon: Globe },
  { num: "03", title: "Configuramos tu intranet", desc: "Nuestro equipo de soporte técnico crea tu plataforma y realiza toda la configuración inicial en aprox. 15 minutos.", icon: Zap },
  { num: "04", title: "Recibe tus credenciales y comienza", desc: "Recibirás usuario, contraseña, link de tu intranet y video tutorial. En pocos minutos podrás comenzar a usar EduNet.", icon: Award },
];

const testimonials = [
  { name: "María Torres Gutiérrez", role: "Directora General", school: "Colegio San Martín de Porres, Lima", text: "EduNet transformó la comunicación en nuestro colegio. Los padres ahora están informados en tiempo real. Redujimos quejas en un 80%.", stars: 5 },
  { name: "Carlos Mendoza Rivera", role: "Administrador", school: "I.E. Los Andes, Arequipa", text: "La plataforma es increíblemente intuitiva. En una semana ya teníamos todo funcionando. El soporte es excepcional.", stars: 5 },
  { name: "Ana Flores Castillo", role: "Coordinadora Académica", school: "Colegio Santa Rosa, Trujillo", text: "Los reportes automáticos nos ahorran 15+ horas semanales. Calificaciones y asistencias ahora centralizadas.", stars: 5 },
];

const faqs = [
  { q: "¿Qué es EduNet?", a: "EduNet es una plataforma de intranet escolar diseñada para digitalizar la gestión completa de colegios en Perú. Permite controlar asistencia, pagos, calificaciones, comunicaciones y más desde un solo lugar." },
  { q: "¿Cuánto cuesta activar la intranet?", a: "Los primeros 2 meses cuestan solo S/50 al mes. A partir del tercer mes, el precio es de S/0.70 por alumno al mes. Sin contratos, cancela cuando quieras." },
  { q: "¿Necesito conocimientos técnicos para usar EduNet?", a: "No. EduNet es muy fácil de usar. Nuestro equipo se encarga de toda la configuración inicial y te proporcionamos video tutoriales para empezar." },
  { q: "¿Qué tipo de colegios pueden usar EduNet?", a: "Colegios de todos los niveles: inicial, primaria y secundaria. EduNet se adapta a la estructura de cada institución educativa." },
  { q: "¿Cómo funciona la asistencia con código QR?", a: "Cada alumno tiene un código QR único. Al escanearlo con un celular, se registra automáticamente la hora de entrada y salida. Los padres pueden ver la asistencia en tiempo real." },
  { q: "¿EduNet permite controlar los pagos de pensiones?", a: "Sí. Puedes registrar pagos, ver el estado de cuentas de cada alumno, identificar morosos y generar reportes financieros." },
  { q: "¿Qué ocurre con los alumnos que no han pagado?", a: "El sistema puede configurarse para restringir o permitir el acceso de alumnos con pagos pendientes, según la preferencia del colegio." },
  { q: "¿Los padres pueden ver la información de sus hijos?", a: "Sí. Los padres tienen acceso a un portal donde pueden ver asistencia, calificaciones, tareas, comunicados y el estado de pagos de sus hijos." },
  { q: "¿Se pueden generar boletas de notas?", a: "Sí. EduNet genera boletas de notas automáticas por alumno, con promedios por curso y consolidados por grado y sección." },
  { q: "¿EduNet funciona en celulares?", a: "Sí. EduNet funciona desde cualquier navegador web en celulares, tablets y computadoras. También se puede instalar como aplicación en el celular." },
  { q: "¿Qué pasa si necesito ayuda?", a: "Contamos con soporte técnico en español disponible por WhatsApp. Respuesta en menos de 1 hora en horario laboral." },
];

const WA_DEMO_URL = "https://wa.me/51992021294?text=Hola%2C%20quiero%20solicitar%20una%20demo%20de%20EduNet";

export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ChatterPal widget - solo en Landing page
  useEffect(() => {
    document.body.classList.add("chatpal-landing-active");

    // 1. Unhide any previously hidden ChatPal containers (SPA navigation back)
    document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]').forEach(el => {
      if (el.querySelector('iframe[src*="chatterpal"]') || el.querySelector('iframe[src*="chatpal"]')) {
        el.style.removeProperty('display');
        el.style.removeProperty('visibility');
      }
    });

    const SCRIPT_ID = "chatpal-landing-script";

    // Helper: initialize or re-show ChatPal widget
    const ensureChatPalVisible = () => {
      if (!window.ChatPal) return false;
      // If iframe already exists, just make sure container is visible
      const existingIframe = document.querySelector('iframe[src*="chatterpal"], iframe[src*="chatpal"]');
      if (existingIframe) {
        const container = existingIframe.closest('div[style*="position: fixed"], div[style*="position:fixed"]') || existingIframe.parentElement;
        if (container) {
          container.style.removeProperty('display');
          container.style.removeProperty('visibility');
        }
        return true;
      }
      // No iframe yet — create widget
      try {
        new window.ChatPal({ embedId: "AuGQNfpZmDFa", remoteBaseUrl: "https://chatterpal.me/", version: "8.5" });
        return true;
      } catch (e) { return false; }
    };

    if (!document.getElementById(SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://chatterpal.me/build/js/chatpal.js?8.5";
      script.integrity = "sha384-+YIWcPZjPZYuhrEm13vJJg76TIO/g7y5B14VE35zhQdrojfD9dPemo7q6vnH44FR";
      script.crossOrigin = "anonymous";
      script.setAttribute("data-cfasync", "false");
      script.onload = () => {
        // Retry for mobile where ChatPal may not be ready immediately after script load
        if (!ensureChatPalVisible()) {
          let retries = 0;
          const retryInit = setInterval(() => {
            if (ensureChatPalVisible() || ++retries >= 10) clearInterval(retryInit);
          }, 500);
        }
      };
      document.body.appendChild(script);
    } else {
      // Script already in DOM — ensure widget is visible (handles SPA return + mobile)
      if (!ensureChatPalVisible()) {
        let retries = 0;
        const retryInit = setInterval(() => {
          if (ensureChatPalVisible() || ++retries >= 10) clearInterval(retryInit);
        }, 500);
      }
    }

    // Overlay play button centered over ChatPal avatar
    const OVERLAY_ID = "chatpal-play-overlay";
    const addPlayOverlay = setInterval(() => {
      if (document.getElementById(OVERLAY_ID)) { clearInterval(addPlayOverlay); return; }
      const iframes = document.querySelectorAll('iframe[src*="chatterpal"], iframe[src*="chatpal"]');
      for (const iframe of iframes) {
        const container = iframe.closest('div[style*="position: fixed"], div[style*="position:fixed"]') || iframe.parentElement;
        if (!container) continue;
        // 1. Wrapper overlay — position: relative context over the container
        const wrapper = document.createElement("div");
        wrapper.id = OVERLAY_ID;
        Object.assign(wrapper.style, {
          position: "absolute", top: "0", left: "0", right: "0", bottom: "0",
          zIndex: "99999", pointerEvents: "none",
        });
        // 2. Centered play button — absolute centering per spec
        const btn = document.createElement("div");
        Object.assign(btn.style, {
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: "52px", height: "52px", borderRadius: "50%",
          background: "rgba(0,180,255,0.9)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", pointerEvents: "auto",
          boxShadow: "0 4px 20px rgba(0,180,255,0.5)",
          transition: "transform 0.2s ease, opacity 0.3s ease",
        });
        btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="white"><polygon points="6,3 20,12 6,21"/></svg>';
        btn.onmouseenter = () => { btn.style.transform = "translate(-50%, -50%) scale(1.15)"; };
        btn.onmouseleave = () => { btn.style.transform = "translate(-50%, -50%) scale(1)"; };
        btn.onclick = () => {
          iframe.dispatchEvent(new MouseEvent("click", { bubbles: true }));
          iframe.click();
          wrapper.style.opacity = "0";
          wrapper.style.transition = "opacity 0.3s ease";
          setTimeout(() => wrapper.remove(), 350);
        };
        wrapper.appendChild(btn);
        // Ensure container establishes positioning context
        const pos = window.getComputedStyle(container).position;
        if (pos === "static") container.style.position = "relative";
        container.appendChild(wrapper);
        clearInterval(addPlayOverlay);
        break;
      }
    }, 800);

    return () => {
      document.body.classList.remove("chatpal-landing-active");
      clearInterval(addPlayOverlay);
      const overlay = document.getElementById(OVERLAY_ID);
      if (overlay) overlay.remove();
      document.querySelectorAll('div[style*="position: fixed"], div[style*="position:fixed"]').forEach(el => {
        if (el.querySelector('iframe[src*="chatterpal"]') || el.querySelector('iframe[src*="chatpal"]')) {
          el.style.setProperty('display', 'none', 'important');
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1a] overflow-x-hidden" data-testid="landing-page">

      {/* ═══════════════ NAVBAR ═══════════════ */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0f1a]/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16 sm:h-[72px]">
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
            <a href={WA_DEMO_URL} target="_blank" rel="noopener noreferrer" className="group relative text-sm font-bold px-6 py-2.5 rounded-xl overflow-hidden" data-testid="landing-register-btn">
              <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] to-amber-400 transition-transform group-hover:scale-105" />
              <span className="relative text-[#0a0f1a]">Informes</span>
            </a>
          </div>
        </div>
      </nav>

      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex items-center pt-16 sm:pt-[72px] overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-[#1e40af]/30 rounded-full blur-[80px] sm:blur-[120px]" />
          <div className="absolute top-1/3 right-0 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-[#7c3aed]/20 rounded-full blur-[80px] sm:blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-[#e1b82c]/10 rounded-full blur-[80px] sm:blur-[100px]" />
        </div>
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 lg:py-16">
          <div className="flex flex-col lg:flex-row items-center gap-10 sm:gap-12 lg:gap-20">
            {/* Left */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-5 sm:mb-8 backdrop-blur-sm">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e1b82c]" />
                <span className="text-[10px] sm:text-xs font-bold text-white/70 uppercase tracking-wider">Plataforma #1 en Perú</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] sm:leading-[1.05] mb-4 sm:mb-6" data-testid="landing-hero-title">
                La intranet que
                <span className="relative inline-block ml-2 sm:ml-3">
                  <span className="relative z-10 bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400 bg-clip-text text-transparent">transforma</span>
                  <div className="absolute -bottom-1 sm:-bottom-2 left-0 right-0 h-2 sm:h-3 bg-gradient-to-r from-[#e1b82c]/40 to-orange-400/40 blur-lg" />
                </span>
                <br />tu colegio
              </h1>

              {/* QR description */}
              <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-10 max-w-xl mx-auto lg:mx-0">
                <div className="shrink-0 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#e1b82c]/20 to-amber-500/10 border border-white/10 flex items-center justify-center mt-0.5">
                  <QrCode className="w-6 h-6 sm:w-9 sm:h-9 lg:w-11 lg:h-11 text-[#e1b82c]" />
                </div>
                <p className="text-sm sm:text-lg lg:text-xl text-white/50 leading-relaxed">
                  Controla la asistencia de tus alumnos con códigos QR en segundos.
                  <br className="hidden sm:block" />
                  <span className="text-white/40">Escanea desde el celular y registra entradas automáticamente.</span>
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start mb-6 sm:mb-10">
                <a href={WA_DEMO_URL} target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center justify-center gap-2 sm:gap-3 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base overflow-hidden min-h-[48px]" data-testid="hero-register-btn">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400" />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-[#e1b82c] opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative text-[#0a0f1a]">Informes</span>
                  <ArrowRight className="relative w-4 h-4 sm:w-5 sm:h-5 text-[#0a0f1a] group-hover:translate-x-1 transition-transform" />
                </a>
                <Link to="/login" className="group inline-flex items-center justify-center gap-2 sm:gap-3 bg-white/[0.05] border border-white/10 text-white font-semibold px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base transition-all hover:bg-white/10 hover:border-white/20 backdrop-blur-sm min-h-[48px]" data-testid="hero-login-btn">
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white/50" />
                  Ingresar a mi Intranet
                </Link>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 sm:gap-6 text-xs sm:text-sm text-white/40">
                <span className="flex items-center gap-1.5 sm:gap-2"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> Sin tarjeta</span>
                <span className="flex items-center gap-1.5 sm:gap-2"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> 5 min setup</span>
                <span className="flex items-center gap-1.5 sm:gap-2"><CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" /> Soporte español</span>
              </div>
            </div>

            {/* Right - Dashboard + Phone + Form */}
            <div className="flex-1 max-w-2xl w-full">
              <div className="relative">
                <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-r from-[#1e40af]/40 via-[#7c3aed]/20 to-[#e1b82c]/20 rounded-[2rem] blur-2xl sm:blur-3xl opacity-60" />

                <div className="relative lg:w-[115%]">
                  {/* Dashboard image with mask */}
                  <img
                    alt="EduNet - Plataforma de gestión escolar"
                    className="w-full h-auto"
                    loading="lazy"
                    data-testid="hero-dashboard-image"
                    src="https://customer-assets.emergentagent.com/job_d0ea565a-5ab8-49d6-8b8e-5c0e85764ea0/artifacts/3qb8ccoe_image%20%282%29.webp"
                    style={{ maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 75%, transparent 100%), linear-gradient(to bottom, transparent 0%, black 15%, black 80%, transparent 100%)", maskComposite: "intersect", WebkitMaskComposite: "source-in" }}
                  />

                  {/* Panel en vivo badge */}
                  <div className="hidden sm:flex absolute bottom-[15%] left-0 bg-[#0a0f1a]/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 items-center gap-3 shadow-xl">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Panel en vivo</p>
                      <p className="text-[10px] text-white/40">Datos en tiempo real</p>
                    </div>
                  </div>
                </div>

                {/* Phone mockup - floating */}
                <div
                  className="hidden lg:block absolute z-10"
                  style={{ right: 310, bottom: -100, animation: "heroFloat 6s ease-in-out infinite", filter: "drop-shadow(0 20px 40px rgba(0,0,0,0))" }}
                >
                  <div className="relative" style={{ boxShadow: "0 0 60px rgba(59,130,246,0)", borderRadius: "2rem" }}>
                    <img
                      alt="Asistencia QR desde celular"
                      className="h-[400px] w-auto"
                      data-testid="hero-phone-qr"
                      src="https://customer-assets.emergentagent.com/job_4cbc4c11-6f79-4a12-b40a-227b88aff89d/artifacts/8imw6hx9_celular_qr_transparente_final.png"
                      style={{ transform: "rotate(-6deg)" }}
                    />
                  </div>
                </div>

                {/* Lead form */}
                <div className="mt-6 lg:mt-0 lg:absolute lg:-right-[10%] lg:top-1/2 lg:-translate-y-1/2 z-20 flex justify-center lg:justify-end">
                  <form
                    data-testid="hero-lead-form"
                    className="w-full sm:w-[340px] rounded-2xl p-5 sm:p-6 border"
                    style={{ background: "rgba(10,10,20,0.75)", backdropFilter: "blur(12px)", borderColor: "rgba(255,255,255,0.05)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)" }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const msg = `Hola, deseo más información.%0A%0ANombre: ${encodeURIComponent(leadName)}%0ATeléfono: +51 ${encodeURIComponent(leadPhone)}%0AEmail: ${encodeURIComponent(leadEmail)}`;
                      window.open(`https://wa.me/51992021294?text=${msg}`, "_blank");
                    }}
                  >
                    <h3 className="text-xl font-extrabold text-white mb-1">
                      Prueba EduNet <span className="text-[#e1b82c]">en tu colegio</span>
                    </h3>
                    <p className="text-sm text-white/40 mb-5">Crea tu intranet escolar en minutos.</p>
                    <div className="space-y-3">
                      <input
                        data-testid="lead-school-name"
                        required
                        placeholder="Nombre del colegio"
                        className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 focus:bg-white/[0.08] transition-all"
                        type="text"
                        value={leadName}
                        onChange={(e) => setLeadName(e.target.value)}
                      />
                      <div className="flex bg-white/[0.06] border border-white/10 rounded-xl overflow-hidden focus-within:border-white/25 focus-within:bg-white/[0.08] transition-all">
                        <div className="flex items-center gap-1.5 px-3 border-r border-white/10 shrink-0">
                          <span className="text-sm text-white font-semibold">PE</span>
                          <span className="text-sm text-white/50">+51</span>
                        </div>
                        <input
                          data-testid="lead-whatsapp"
                          required
                          maxLength={9}
                          pattern="[0-9]{9}"
                          placeholder="987 654 321"
                          className="w-full bg-transparent px-3 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                          type="tel"
                          value={leadPhone}
                          onChange={(e) => setLeadPhone(e.target.value.replace(/\D/g, ""))}
                        />
                      </div>
                      <input
                        data-testid="lead-email"
                        required
                        placeholder="Correo electrónico"
                        className="w-full bg-white/[0.06] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 focus:bg-white/[0.08] transition-all"
                        type="email"
                        value={leadEmail}
                        onChange={(e) => setLeadEmail(e.target.value)}
                      />
                    </div>
                    <button
                      type="submit"
                      data-testid="lead-submit-btn"
                      className="w-full mt-5 font-extrabold text-sm py-3.5 rounded-xl text-[#0a0f1a] transition-all hover:brightness-110 tracking-wide"
                      style={{ background: "linear-gradient(90deg, #ffd33d, #ff8a00)" }}
                    >
                      PROBAR EDUNET
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0f1a] to-transparent" />
      </section>

      {/* ═══════════════ STATS ═══════════════ */}
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

      {/* ═══════════════ BENEFITS VIDEO ═══════════════ */}
      <BenefitsVideoSection />

      {/* ═══════════════ PRICING ═══════════════ */}
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
            {/* Pricing card */}
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
                  {["Asistencia con código QR","Gestión de alumnos","Gestión de profesores","Comunicación con padres","Tareas y calificaciones","Reportes académicos","Acceso desde celular y computadora","Subdominio para el colegio","Soporte técnico"].map((feat) => (
                    <li key={feat} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-[#e1b82c]/20 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-[#e1b82c]" />
                      </div>
                      <span className="text-sm text-white/60">{feat}</span>
                    </li>
                  ))}
                </ul>
                <a href={WA_DEMO_URL} target="_blank" rel="noopener noreferrer" className="block text-center font-bold py-3.5 rounded-xl bg-gradient-to-r from-[#e1b82c] to-amber-400 text-[#0a0f1a] hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all" data-testid="pricing-cta">
                  Iniciar prueba
                </a>
              </div>
            </div>

            {/* Calculator */}
            <PriceCalculator />
          </div>
        </div>
      </section>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <section id="features" className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute top-1/2 left-0 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] bg-[#1e40af]/20 rounded-full blur-[80px] sm:blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[150px] sm:w-[300px] h-[150px] sm:h-[300px] bg-[#e1b82c]/10 rounded-full blur-[80px] sm:blur-[100px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <span className="text-[10px] sm:text-xs font-bold text-white/60 uppercase tracking-wider">Funcionalidades</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 sm:mb-5">
              Todo lo que tu colegio <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">necesita</span>
            </h2>
            <p className="text-sm sm:text-lg text-white/40 max-w-2xl mx-auto leading-relaxed">Una plataforma completa para digitalizar la gestión escolar.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="group relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${f.color} rounded-2xl opacity-0 group-hover:opacity-10 blur-xl transition-opacity duration-500`} />
                  <div className="relative h-full bg-gradient-to-br from-white/[0.05] to-transparent backdrop-blur-sm rounded-2xl p-5 sm:p-7 border border-white/5 hover:border-white/10 transition-all duration-300">
                    <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 sm:mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-white mb-1.5 sm:mb-2">{f.title}</h3>
                    <p className="text-sm text-white/60 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <section id="how-it-works" className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e3a8a] via-[#1e40af] to-[#3b0764]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2230%22 height=%2230%22 viewBox=%220 0 30 30%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cpath d=%22M0 0h30v30H0z%22 fill=%22none%22/%3E%3Ccircle cx=%221%22 cy=%221%22 r=%221%22 fill=%22rgba(255,255,255,0.03)%22/%3E%3C/svg%3E')]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#e1b82c]" />
              <span className="text-[10px] sm:text-xs font-bold text-white/70 uppercase tracking-wider">Cómo funciona</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 sm:mb-5">
              Tu intranet lista en <span className="text-[#e1b82c]">4 pasos</span>
            </h2>
            <p className="text-sm sm:text-lg text-blue-200/50 max-w-xl mx-auto leading-relaxed">Sin complicaciones técnicas. Sin necesidad de un equipo de IT.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="relative group">
                  {i < 3 && <div className="hidden lg:block absolute top-12 left-full w-full h-0.5 bg-gradient-to-r from-white/20 to-transparent z-0" />}
                  <div className="relative bg-white/[0.05] backdrop-blur-sm border border-white/10 rounded-2xl p-5 sm:p-8 hover:bg-white/[0.08] transition-all hover:-translate-y-1">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#e1b82c] to-amber-500 flex items-center justify-center mb-4 sm:mb-6 shadow-xl shadow-[#e1b82c]/20 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-[#0a0f1a]" />
                    </div>
                    <span className="text-[10px] sm:text-xs font-extrabold text-[#e1b82c] tracking-widest">PASO {s.num}</span>
                    <h3 className="text-base sm:text-lg font-bold text-white mt-1.5 sm:mt-2 mb-2 sm:mb-3">{s.title}</h3>
                    <p className="text-sm text-blue-200/50 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ TESTIMONIALS ═══════════════ */}
      <section id="testimonials" className="relative py-16 sm:py-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]" />
        <div className="absolute top-0 right-1/4 w-[250px] sm:w-[500px] h-[250px] sm:h-[500px] bg-[#7c3aed]/20 rounded-full blur-[100px] sm:blur-[150px]" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6">
              <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-400 fill-violet-400" />
              <span className="text-[10px] sm:text-xs font-bold text-white/60 uppercase tracking-wider">Testimonios</span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-3 sm:mb-5">
              Lo que dicen <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">nuestros clientes</span>
            </h2>
            <p className="text-sm sm:text-lg text-white/40 leading-relaxed">Colegios reales que ya transformaron su gestión.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
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

      {/* ═══════════════ FAQ ═══════════════ */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-4 sm:mb-6">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400" />
              <span className="text-[10px] sm:text-xs font-bold text-white/60 uppercase tracking-wider">FAQ</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white">Preguntas frecuentes</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white/[0.02] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-colors">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between p-6 text-left"
                  data-testid={`faq-${i}`}
                >
                  <span className="text-base font-semibold text-white pr-4">{faq.q}</span>
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

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1e40af] via-[#3b0764] to-[#1e3a8a]" />
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#e1b82c]/20 rounded-full blur-[150px]" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-500/30 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white mb-4 sm:mb-6">
            El futuro de tu colegio<br />
            <span className="bg-gradient-to-r from-[#e1b82c] to-amber-400 bg-clip-text text-transparent">empieza hoy</span>
          </h2>
          <p className="text-sm sm:text-lg text-blue-100/50 mb-6 sm:mb-10 max-w-xl mx-auto leading-relaxed">
            Únete a más de 120 colegios que ya transformaron su gestión con EduNet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <a href={WA_DEMO_URL} target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center justify-center gap-2 px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base overflow-hidden min-h-[48px]" data-testid="cta-register-btn">
              <div className="absolute inset-0 bg-gradient-to-r from-[#e1b82c] via-amber-400 to-orange-400" />
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-[#e1b82c] opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative text-[#0a0f1a]">Informes</span>
              <ArrowRight className="relative w-4 h-4 sm:w-5 sm:h-5 text-[#0a0f1a] group-hover:translate-x-1 transition-transform" />
            </a>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 border-2 border-white/20 text-white font-semibold px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl text-sm sm:text-base hover:bg-white/10 hover:border-white/30 transition-all min-h-[48px]" data-testid="cta-login-btn">
              Ingresar a mi Intranet
            </Link>
          </div>
          <p className="text-xs text-blue-200/30 mt-6 sm:mt-10">Sin tarjeta de crédito · Sin contratos · Cancela cuando quieras</p>
        </div>
      </section>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <footer className="relative bg-[#060a14] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#e1b82c] to-amber-500 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-[#0a0f1a]" />
                </div>
                <span className="text-xl font-extrabold text-white">EduNet</span>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">La plataforma de intranet escolar más confiable de Perú.</p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4">Producto</h4>
              <ul className="space-y-3">
                <li><a href="#features" className="text-sm text-white/40 hover:text-white/70 transition-colors">Funcionalidades</a></li>
                <li><a href="#pricing" className="text-sm text-white/40 hover:text-white/70 transition-colors">Planes y precios</a></li>
                <li><a href="#features" className="text-sm text-white/40 hover:text-white/70 transition-colors">Seguridad</a></li>
              </ul>
            </div>

            {/* Soporte */}
            <div>
              <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4">Soporte</h4>
              <ul className="space-y-3">
                <li><a href="https://wa.me/51992021294" target="_blank" rel="noopener noreferrer" className="text-sm text-white/40 hover:text-white/70 transition-colors">Centro de ayuda</a></li>
                <li><a href="https://wa.me/51992021294" target="_blank" rel="noopener noreferrer" className="text-sm text-white/40 hover:text-white/70 transition-colors">Contacto</a></li>
                <li><span className="text-sm text-white/40">Estado del servicio</span></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-bold text-white/70 uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-3">
                <li><span className="text-sm text-white/40">Términos de servicio</span></li>
                <li><span className="text-sm text-white/40">Privacidad</span></li>
                <li><span className="text-sm text-white/40">Protección de datos</span></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/30">EduNet © 2026 — Todos los derechos reservados. Lima, Perú.</p>
            <div className="flex items-center gap-4">
              <a href="mailto:contacto@edunet.pe" className="text-white/30 hover:text-white/60 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
              <a href="https://wa.me/51992021294" target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60 transition-colors">
                <Phone className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══════════════ ANIMATIONS ═══════════════ */}
      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
        }
      `}</style>

      {/* ═══════════════ WHATSAPP BUTTON ═══════════════ */}
      <a
        href="https://wa.me/51992021294"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-0 group"
        data-testid="whatsapp-float-btn"
      >
        <span className="bg-white text-slate-800 text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg mr-[-8px] opacity-0 group-hover:opacity-100 group-hover:mr-2 transition-all duration-300 whitespace-nowrap">
          Chatea con nosotros
        </span>
        <div className="w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] flex items-center justify-center shadow-lg shadow-[#25D366]/40 hover:shadow-xl hover:shadow-[#25D366]/50 transition-all hover:scale-110">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
      </a>
    </div>
  );
}


function BenefitsVideoSection() {
  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/3 w-[300px] h-[300px] bg-[#e1b82c]/5 rounded-full blur-[120px]" />

      <div className="relative z-10 max-w-[950px] mx-auto">
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

        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/25 via-violet-500/15 to-[#e1b82c]/15 rounded-3xl blur-2xl opacity-60 group-hover:opacity-80 transition-opacity duration-500" />
          <div className="relative rounded-2xl p-[2px] bg-gradient-to-br from-white/20 via-white/10 to-white/5">
            <div className="rounded-[14px] overflow-hidden bg-[#0a0f1a]">
              <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                <iframe
                  className="absolute inset-0 w-full h-full"
                  src="https://player.vimeo.com/video/1178330929?badge=0&autopause=0&player_id=0&app_id=58479"
                  title="Presentación EduNet"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  frameBorder="0"
                  data-testid="benefits-video"
                />
              </div>
            </div>
          </div>
        </div>

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
            {[{ s: 50, p: 50 }, { s: 80, p: 56 }, { s: 200, p: 140 }].map((ex) => (
              <div key={ex.s} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white/[0.03] border border-white/5">
                <span className="text-sm text-white/50">{ex.s} alumnos</span>
                <span className="text-sm font-bold text-[#e1b82c]">S/{ex.p} / mes</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-8">
        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white/70">Primeros 2 meses: Solo S/50</p>
          <p className="text-xs text-white/30">Luego el precio se calcula según la cantidad de alumnos.</p>
        </div>
      </div>

      <a
        href={WA_DEMO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center font-bold py-3.5 rounded-xl bg-gradient-to-r from-[#e1b82c] to-amber-400 text-[#0a0f1a] hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all mb-3"
        data-testid="calculator-cta"
      >
        Iniciar prueba
      </a>
      <p className="text-center text-xs text-white/25">Sin contratos. Cancela cuando quieras.</p>
    </div>
  );
}
