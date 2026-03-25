import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";

export default function FloatingHelpAvatar({ subdomain }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <>
      <style>{`
        @keyframes bounceUp {
          0% { transform: translateY(200px); opacity: 0; }
          50% { transform: translateY(-15px); opacity: 1; }
          70% { transform: translateY(8px); }
          85% { transform: translateY(-4px); }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-bounce-up { animation: bounceUp 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
      <div
        className="fixed bottom-6 right-6 z-50 hidden lg:flex flex-col items-center gap-2 animate-bounce-up"
        data-testid="floating-help-avatar"
      >
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
            className="absolute -top-1 -right-1 z-10 w-6 h-6 bg-slate-800 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
            data-testid="floating-help-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <div
            className="w-36 h-36 rounded-full overflow-hidden shadow-2xl hover:scale-105 transition-transform cursor-pointer ring-[5px] ring-orange-400 bg-green-100"
            onClick={() => navigate(subdomain ? `/${subdomain}/academia` : "/academia")}
          >
            <img
              src="https://customer-assets.emergentagent.com/job_b91f707a-1a92-469c-9853-602cda64d52a/artifacts/vbv0s9n6_avatar%20-transparente.png"
              alt="Asistente"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <div
          className="relative px-5 py-2.5 rounded-2xl shadow-xl text-center overflow-hidden cursor-pointer hover:scale-105 transition-transform"
          style={{ background: "linear-gradient(135deg, #1B6B50 0%, #257A5C 50%, #1B6B50 100%)" }}
          onClick={() => navigate(subdomain ? `/${subdomain}/academia` : "/academia")}
        >
          <div className="absolute inset-0 rounded-2xl" style={{ border: "1.5px solid rgba(251,191,36,0.35)" }} />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)" }} />
          <p className="text-[13px] font-bold text-white tracking-wide leading-tight">Videos Tutoriales</p>
        </div>
      </div>
    </>
  );
}
