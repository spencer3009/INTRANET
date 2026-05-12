// RightDrawer — Slide-in lateral derecho con backdrop y ESC para cerrar.
import { useEffect } from "react";
import { X } from "lucide-react";

export default function RightDrawer({ open, onClose, title, subtitle, width = "60%", children, footer, testId = "right-drawer" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" data-testid={testId}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <aside
        className="absolute top-0 right-0 h-full bg-slate-50 shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300"
        style={{ width: typeof width === "number" ? `${width}px` : width, maxWidth: "100vw" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${testId}-title`}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
          <div>
            <h2 id={`${testId}-title`} className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Cerrar"
            data-testid={`${testId}-close`}
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </header>
        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {/* Footer (opcional) */}
        {footer && (
          <footer className="px-6 py-3 border-t border-slate-200 bg-white">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
