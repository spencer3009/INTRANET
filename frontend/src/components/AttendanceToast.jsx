import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, LogIn, LogOut, Clock, AlertTriangle } from "lucide-react";

const EVENT_CONFIG = {
  ingreso: { icon: LogIn, color: "from-emerald-500 to-green-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "INGRESO" },
  salida: { icon: LogOut, color: "from-orange-500 to-amber-500", bg: "bg-orange-50", text: "text-orange-700", label: "SALIDA" },
  tardanza: { icon: Clock, color: "from-amber-500 to-yellow-500", bg: "bg-amber-50", text: "text-amber-700", label: "TARDANZA" },
  inasistencia: { icon: AlertTriangle, color: "from-red-500 to-rose-500", bg: "bg-red-50", text: "text-red-700", label: "INASISTENCIA" },
};

function ToastItem({ toast, onDismiss }) {
  const [exiting, setExiting] = useState(false);
  const config = EVENT_CONFIG[toast.event_type] || EVENT_CONFIG.ingreso;
  const Icon = config.icon;

  useEffect(() => {
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(toast.toastId), 300);
    }, 8000);
    return () => clearTimeout(timer);
  }, [toast.toastId, onDismiss]);

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.toastId), 300);
  };

  return (
    <div
      className={`relative w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transition-all duration-300 ${
        exiting ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"
      }`}
      style={{ animation: exiting ? "none" : "slideInRight 0.3s ease-out" }}
      data-testid={`attendance-toast-${toast.event_type}`}
    >
      <div className={`h-1.5 bg-gradient-to-r ${config.color}`} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-5 h-5 ${config.text}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white bg-gradient-to-r ${config.color}`}>
                {config.label}
              </span>
              <span className="text-[10px] text-gray-400">Ahora</span>
            </div>
            <p className="text-sm font-medium text-gray-800 leading-snug">{toast.body}</p>
            {toast.school_name && (
              <p className="text-[11px] text-gray-400 mt-1">{toast.school_name}</p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="w-6 h-6 rounded-lg hover:bg-gray-100 flex items-center justify-center flex-shrink-0 transition-colors"
            data-testid="attendance-toast-dismiss"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceToast() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((toastId) => {
    setToasts(prev => prev.filter(t => t.toastId !== toastId));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const notif = e.detail;
      setToasts(prev => [
        { ...notif, toastId: Date.now() + Math.random() },
        ...prev
      ].slice(0, 3));
    };
    window.addEventListener("attendance-notification", handler);
    return () => window.removeEventListener("attendance-notification", handler);
  }, []);

  if (!toasts.length) return null;

  return createPortal(
    <div className="fixed top-4 right-4 flex flex-col gap-3" style={{ zIndex: 99999 }} data-testid="attendance-toast-container">
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(100px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      {toasts.map((t) => (
        <ToastItem key={t.toastId} toast={t} onDismiss={dismiss} />
      ))}
    </div>,
    document.body
  );
}
