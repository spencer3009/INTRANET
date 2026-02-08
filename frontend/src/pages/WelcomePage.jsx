import { Link } from "react-router-dom";
import { GraduationCap, Sparkles } from "lucide-react";

export default function WelcomePage({ user }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafbfc] px-6" data-testid="welcome-page">
      <div className="w-full max-w-lg text-center">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-9 h-9 rounded-xl bg-[#001f4b] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#e1b82c]" />
          </div>
          <span className="text-xl font-extrabold text-[#001f4b]" style={{ fontFamily: "Manrope" }}>
            EduNet
          </span>
        </div>

        <div className="w-24 h-24 rounded-full bg-[#e1b82c]/10 flex items-center justify-center mx-auto mb-8">
          <Sparkles className="w-12 h-12 text-[#e1b82c]" />
        </div>

        <h1
          className="text-3xl font-extrabold text-[#001f4b] mb-3"
          style={{ fontFamily: "Manrope" }}
          data-testid="welcome-title"
        >
          ¡Bienvenido{user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
        </h1>

        <p className="text-lg text-slate-600 mb-2">
          Vamos a crear la intranet de tu colegio.
        </p>
        <p className="text-sm text-slate-400 mb-10">
          Solo necesitamos un paso más para dejar todo listo.
        </p>

        <Link
          to="/onboarding"
          className="inline-flex items-center justify-center gap-2 bg-[#001f4b] text-white font-semibold px-10 py-4 rounded-2xl text-base hover:bg-[#001f4b]/90 transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-[#001f4b]/20"
          data-testid="welcome-start-btn"
        >
          Empezar configuración
        </Link>

        <p className="text-xs text-slate-400 mt-8">
          Toma menos de 2 minutos
        </p>
      </div>
    </div>
  );
}
