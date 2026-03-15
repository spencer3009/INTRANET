import { useState } from "react";
import { AlertTriangle, CreditCard, Info, X } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";

export default function SubscriptionBanner({ onPayClick }) {
  const ctx = useSubscription();
  const [hidden, setHidden] = useState(false);

  if (hidden || !ctx || !ctx.sub) return null;

  const { plan_estado, dias_vencido, fecha_vencimiento, monto_plan } = ctx.sub;

  // Only show for non-active, non-verification states
  if (!plan_estado || plan_estado === "ACTIVO" || plan_estado === "PAGO_EN_VERIFICACION") return null;

  const fmtDate = fecha_vencimiento
    ? new Date(fecha_vencimiento).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div
      className="sticky top-0 z-40 bg-red-50 border-b-2 border-red-300 px-4 py-3"
      data-testid="subscription-banner"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Icon + Text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4 text-red-600" />
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

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-11 sm:ml-0">
          <button
            onClick={() => setHidden(true)}
            className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors"
            data-testid="banner-hide-btn"
          >
            Ocultar
          </button>
          <button
            className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            data-testid="banner-info-btn"
            onClick={onPayClick}
          >
            Mas informacion
          </button>
          <button
            onClick={onPayClick}
            className="px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5"
            data-testid="banner-pay-btn"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Pagar ahora
          </button>
        </div>
      </div>
    </div>
  );
}
