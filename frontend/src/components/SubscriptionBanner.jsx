import { useState } from "react";
import { AlertTriangle, CreditCard, Info, X } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";
import PaymentBlockModal from "./PaymentBlockModal";

export default function SubscriptionBanner() {
  const ctx = useSubscription();
  const [showPayModal, setShowPayModal] = useState(false);

  if (!ctx || !ctx.sub) return null;

  const { plan_estado, dias_vencido, fecha_vencimiento, monto_plan } = ctx.sub;

  // Only show for non-active, non-verification states
  if (!plan_estado || plan_estado === "ACTIVO" || plan_estado === "PAGO_EN_VERIFICACION") return null;

  const fmtDate = fecha_vencimiento
    ? new Date(fecha_vencimiento).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : "";

  const token = localStorage.getItem("token") || "";

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[100] bg-red-50 border-2 border-red-300 rounded-xl mx-3 mt-2 px-5 py-3.5 shadow-sm"
        data-testid="subscription-banner"
      >
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-red-800" data-testid="banner-title">
                Se requiere un nuevo pago de suscripcion
                <span className="font-normal text-red-600"> — La plataforma no puede continuar funcionando sin renovar el plan.</span>
              </p>
              <p className="text-xs text-red-600/80 mt-0.5">
                {fmtDate && <>Vencio el {fmtDate}. </>}
                {dias_vencido > 0 && <>{dias_vencido} dia{dias_vencido > 1 ? "s" : ""} vencido. </>}
                {monto_plan > 0 && <>Monto pendiente: <span className="font-bold">S/ {monto_plan.toFixed(2)}</span></>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-10 sm:ml-0">
            <button
              onClick={() => setShowPayModal(true)}
              className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5"
              data-testid="banner-pay-btn"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pagar ahora
            </button>
          </div>
        </div>
      </div>
      {/* Spacer to push content below the fixed banner */}
      <div className="h-[60px]" data-testid="banner-spacer" />

      {showPayModal && (
        <PaymentBlockModal token={token} onClose={() => { setShowPayModal(false); ctx?.refresh(); }} />
      )}
    </>
  );
}
