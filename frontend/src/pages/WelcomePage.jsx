import { Link } from "react-router-dom";
import { GraduationCap, Sparkles, Globe, ArrowRight } from "lucide-react";

export default function WelcomePage({ user }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] px-6" data-testid="welcome-page">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-[#e1b82c]/10 blur-3xl" />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-purple-500/10 blur-3xl" />
      
      <div className="w-full max-w-lg text-center relative z-10">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-10 h-10 rounded-xl bg-[#e1b82c] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#001f4b]" />
          </div>
          <span className="text-xl font-extrabold text-white" style={{ fontFamily: "Manrope" }}>
            EduNet
          </span>
        </div>

        {/* Icon */}
        <div className="w-24 h-24 rounded-full bg-[#e1b82c]/20 border-2 border-[#e1b82c]/30 flex items-center justify-center mx-auto mb-8">
          <Sparkles className="w-12 h-12 text-[#e1b82c]" />
        </div>

        <h1
          className="text-4xl font-extrabold text-white mb-4"
          style={{ fontFamily: "Manrope" }}
          data-testid="welcome-title"
        >
          ¡Bienvenido{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>

        <p className="text-xl text-blue-100/80 mb-2">
          Tu cuenta está verificada.
        </p>
        <p className="text-base text-blue-200/60 mb-10">
          Solo falta un paso: crear el subdominio de tu intranet.
        </p>

        {/* Visual preview */}
        <div className="bg-white/[0.06] backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-[#e1b82c]" />
            <span className="text-sm font-semibold text-white/70">Tu intranet será algo como:</span>
          </div>
          <p className="text-2xl font-bold text-[#e1b82c]" style={{ fontFamily: "Manrope" }}>
            tucolegio.edunet.pe
          </p>
        </div>

        <Link
          to="/onboarding"
          className="inline-flex items-center justify-center gap-3 bg-gradient-to-r from-[#e1b82c] to-amber-500 text-[#001f4b] font-bold px-10 py-4 rounded-2xl text-lg hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all hover:-translate-y-1"
          data-testid="welcome-start-btn"
        >
          Crear mi subdominio
          <ArrowRight className="w-5 h-5" />
        </Link>

        <p className="text-xs text-white/30 mt-10">
          Toma menos de 1 minuto
        </p>
      </div>
    </div>
  );
}
