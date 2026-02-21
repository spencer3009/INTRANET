import { ShieldX, ArrowLeft, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * AccessDenied Component
 * Displays a professional, user-friendly message when access is denied
 */
export default function AccessDenied({ 
  title = "Acceso Restringido",
  message = "No tienes permisos para acceder a esta sección.",
  suggestion = "Contacta al propietario del colegio si crees que deberías tener acceso.",
  showBackButton = true,
  showContactButton = false,
  onBack,
}) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Icon with animated background */}
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center shadow-lg">
            <ShieldX className="w-12 h-12 text-slate-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          {title}
        </h1>

        {/* Message */}
        <p className="text-slate-600 mb-2">
          {message}
        </p>

        {/* Suggestion */}
        <p className="text-sm text-slate-400 mb-8">
          {suggestion}
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver
            </button>
          )}
          
          {showContactButton && (
            <button
              onClick={() => navigate('/messages')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl transition-all shadow-lg"
            >
              <Mail className="w-4 h-4" />
              Contactar
            </button>
          )}
        </div>

        {/* Decorative elements */}
        <div className="mt-12 flex justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-slate-200" />
          <div className="w-2 h-2 rounded-full bg-slate-300" />
          <div className="w-2 h-2 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
