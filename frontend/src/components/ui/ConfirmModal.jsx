import { Loader2, AlertTriangle, Trash2, Check, X, Archive, Power, Ban, CreditCard } from "lucide-react";

/**
 * Professional Confirmation Modal Component
 * 
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Function to close modal
 * @param {function} onConfirm - Function called when confirmed
 * @param {boolean} loading - Show loading state on confirm button
 * @param {string} title - Modal title
 * @param {string} message - Main message/description
 * @param {string} confirmText - Text for confirm button (default: "Confirmar")
 * @param {string} cancelText - Text for cancel button (default: "Cancelar")
 * @param {string} variant - Visual variant: "danger" | "warning" | "success" | "info" (default: "danger")
 * @param {string} icon - Icon type: "delete" | "warning" | "archive" | "power" | "payment" | "ban" (default based on variant)
 * @param {React.ReactNode} children - Optional additional content
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  title = "Confirmar acción",
  message = "¿Estás seguro de realizar esta acción?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  icon,
  children
}) {
  if (!isOpen) return null;

  // Variant configurations
  const variants = {
    danger: {
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      confirmBg: "bg-red-600 hover:bg-red-700",
      confirmText: "text-white",
      defaultIcon: Trash2
    },
    warning: {
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      confirmBg: "bg-amber-600 hover:bg-amber-700",
      confirmText: "text-white",
      defaultIcon: AlertTriangle
    },
    success: {
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
      confirmBg: "bg-emerald-600 hover:bg-emerald-700",
      confirmText: "text-white",
      defaultIcon: Check
    },
    info: {
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      confirmBg: "bg-blue-600 hover:bg-blue-700",
      confirmText: "text-white",
      defaultIcon: AlertTriangle
    }
  };

  // Icon mapping
  const iconMap = {
    delete: Trash2,
    warning: AlertTriangle,
    archive: Archive,
    power: Power,
    payment: CreditCard,
    ban: Ban,
    check: Check
  };

  const config = variants[variant] || variants.danger;
  const IconComponent = icon ? (iconMap[icon] || config.defaultIcon) : config.defaultIcon;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`w-12 h-12 ${config.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
            </div>
            
            {/* Title and Message */}
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-500">{message}</p>
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Additional content */}
          {children && (
            <div className="mt-4">
              {children}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            data-testid="confirm-modal-cancel"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 text-sm font-semibold ${config.confirmText} ${config.confirmBg} rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2`}
            data-testid="confirm-modal-confirm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <IconComponent className="w-4 h-4" />
                {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
