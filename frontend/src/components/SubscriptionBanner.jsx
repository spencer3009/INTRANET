import { AlertTriangle, Clock, ShieldOff, CreditCard, CheckCircle2 } from "lucide-react";
import { useSubscription } from "../contexts/SubscriptionContext";

const BANNER_CONFIG = {
  AVISO_VENCIMIENTO: {
    bg: "bg-amber-500",
    icon: AlertTriangle,
    text: "Su suscripcion ha vencido. Registre su pago para continuar usando la plataforma.",
  },
  RESTRICCION_PARCIAL: {
    bg: "bg-orange-600",
    icon: Clock,
    text: "Su suscripcion esta vencida. Algunas funciones estan restringidas. Registre su pago.",
  },
  PAGO_OBLIGATORIO: {
    bg: "bg-red-600",
    icon: ShieldOff,
    text: "Su suscripcion esta vencida. Debe registrar su pago para continuar.",
  },
  PAGO_EN_VERIFICACION: {
    bg: "bg-blue-600",
    icon: CheckCircle2,
    text: "Su pago esta en proceso de verificacion. Le notificaremos cuando sea confirmado.",
  },
};

export default function SubscriptionBanner({ onPayClick }) {
  const ctx = useSubscription();
  if (!ctx || !ctx.sub) return null;

  const { plan_estado, dias_vencido, fecha_vencimiento } = ctx.sub;

  // Show verification banner
  if (plan_estado === "PAGO_EN_VERIFICACION") {
    const cfg = BANNER_CONFIG.PAGO_EN_VERIFICACION;
    const Icon = cfg.icon;
    return (
      <div className={`${cfg.bg} text-white px-4 py-2.5 text-sm flex items-center justify-center gap-3 flex-wrap`} data-testid="subscription-banner">
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{cfg.text}</span>
      </div>
    );
  }

  const cfg = BANNER_CONFIG[plan_estado];
  if (!cfg) return null;

  const Icon = cfg.icon;
  const fmtDate = fecha_vencimiento
    ? new Date(fecha_vencimiento).toLocaleDateString("es-PE", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div className={`${cfg.bg} text-white px-4 py-2.5 text-sm flex items-center justify-center gap-3 flex-wrap`} data-testid="subscription-banner">
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>
        Su suscripcion a EDU.NET vencio{fmtDate ? ` el ${fmtDate}` : ""}.
        {dias_vencido > 0 && ` (${dias_vencido} dias vencido)`}
        {" "}Registre su pago para continuar.
      </span>
      {onPayClick && (
        <button
          onClick={onPayClick}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition-colors flex items-center gap-1.5"
          data-testid="banner-pay-btn"
        >
          <CreditCard className="w-3.5 h-3.5" />
          Registrar pago
        </button>
      )}
    </div>
  );
}
