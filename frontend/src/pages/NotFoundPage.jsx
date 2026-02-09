import { Link } from "react-router-dom";
import { GraduationCap, Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#001636] via-[#001f4b] to-[#0a3068] px-6" data-testid="not-found-page">
      {/* Decorative elements */}
      <div className="absolute top-20 right-20 w-96 h-96 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute bottom-20 left-20 w-72 h-72 rounded-full bg-[#e1b82c]/10 blur-3xl" />
      
      <div className="w-full max-w-md text-center relative z-10">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-12">
          <div className="w-10 h-10 rounded-xl bg-[#e1b82c] flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-[#001f4b]" />
          </div>
          <span className="text-xl font-extrabold text-white" style={{ fontFamily: "Manrope" }}>
            EduNet
          </span>
        </div>

        {/* 404 */}
        <div className="text-8xl font-extrabold text-white/10 mb-4" style={{ fontFamily: "Manrope" }}>
          404
        </div>

        <h1
          className="text-3xl font-extrabold text-white mb-4"
          style={{ fontFamily: "Manrope" }}
        >
          Página no encontrada
        </h1>

        <p className="text-base text-blue-200/60 mb-10">
          La página que buscas no existe o el colegio ha sido desactivado.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#e1b82c] to-amber-500 text-[#001f4b] font-bold px-8 py-4 rounded-xl hover:shadow-lg hover:shadow-[#e1b82c]/30 transition-all"
          >
            <Home className="w-5 h-5" />
            Ir al inicio
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
