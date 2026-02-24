import { Eye } from 'lucide-react';

/**
 * Demo Blocked Modal - Friendly popup for demo users when they try to modify something
 * Shows a professional message explaining demo mode limitations
 */
export default function DemoBlockedModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4" data-testid="demo-blocked-modal">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-fade-in-up">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
              <Eye className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Modo Visitante</h2>
              <p className="text-blue-100 text-sm">Versión demostrativa</p>
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-slate-700 text-base leading-relaxed">
            Estás explorando <span className="font-semibold text-blue-600">EduNet</span> en modo demostración.
          </p>
          <p className="text-slate-600 mt-3">
            Las funciones de creación y edición están deshabilitadas.
          </p>
          <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-700">
              <span className="font-semibold">✨ Cuando contrates el servicio</span> tendrás acceso completo a todas las funcionalidades del sistema.
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30"
            data-testid="demo-modal-confirm"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper function to check if an error is from demo user being blocked
 * @param {Error} err - The error object from axios
 * @param {Object} user - The current user object
 * @returns {boolean} - True if this is a demo blocked error
 */
export function isDemoBlockedError(err, user) {
  if (!user?.is_demo_user) return false;
  
  const errorMessage = err?.response?.data?.detail || "";
  const statusCode = err?.response?.status;
  
  return (
    errorMessage.toLowerCase().includes("modo visitante") ||
    errorMessage.toLowerCase().includes("demo") ||
    (statusCode === 403 && user.is_demo_user)
  );
}
